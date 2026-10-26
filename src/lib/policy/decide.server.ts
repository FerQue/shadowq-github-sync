// Server-only helper: run the policy engine for one employee and one tool, then record the outcome
// (decision row, audit entry, side effects). The usage event itself is written by the caller.
// Same steps as evaluate.functions.ts; the policy logic stays in ./policy.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { evaluateUsage, type DataClass, type Decision, type Exception, type Service } from "./policy";

type ServiceRow = {
  id: string;
  name: string;
  status: Service["status"];
  ceiling: number | null;
  risk_tier: Service["riskTier"];
  kill_switch: boolean;
  expires_at: string | null;
  vendor_changed: boolean;
  is_default_alternative: boolean;
  owner_id: string | null;
};

const toService = (r: ServiceRow): Service => ({
  id: r.id,
  name: r.name,
  status: r.status,
  ceiling: r.ceiling as DataClass | null,
  riskTier: r.risk_tier,
  killSwitch: r.kill_switch,
  expiresAt: r.expires_at,
  vendorChanged: r.vendor_changed,
  isDefaultAlternative: r.is_default_alternative,
});

export async function decideAndRecord(
  db: SupabaseClient<Database>,
  input: { employeeId: string; serviceId: string; declaredClass: DataClass | null; patternHit: boolean },
): Promise<Decision> {
  const now = new Date();

  const { data: me } = await db.from("employees").select("id, department_id").eq("id", input.employeeId).maybeSingle();
  if (!me) throw new Error("Unknown employee ID.");

  const { data: dept } = await db.from("departments").select("default_class").eq("id", me.department_id).maybeSingle();
  const deptDefault = (dept?.default_class ?? null) as DataClass | null;

  // If the service lookup fails, pass null: the engine applies R9 (fail safe).
  const { data: svcRow } = await db.from("ai_services").select("*").eq("id", input.serviceId).maybeSingle();
  const { data: catalogRows } = await db.from("ai_services").select("*").eq("status", "approved");
  const { data: exRows } = await db
    .from("exceptions")
    .select("*")
    .eq("service_id", input.serviceId)
    .or(`employee_id.eq.${me.id},department_id.eq.${me.department_id}`);

  const decision = evaluateUsage({
    employee: { id: me.id, department: me.department_id },
    service: svcRow ? toService(svcRow as unknown as ServiceRow) : null,
    declaredClass: input.declaredClass,
    departmentDefault: deptDefault,
    patternHit: input.patternHit,
    exceptions: (exRows ?? []).map(
      (e): Exception => ({
        id: e.id,
        serviceId: e.service_id,
        ...(e.employee_id ? { employeeId: e.employee_id } : {}),
        ...(e.department_id ? { department: e.department_id } : {}),
        maxClass: e.max_class as DataClass,
        expiresAt: e.expires_at,
      }),
    ),
    catalog: (catalogRows ?? []).map((r) => toService(r as unknown as ServiceRow)),
    now,
  });

  const { data: saved } = await db
    .from("decisions")
    .insert({
      employee_id: me.id,
      department_id: me.department_id,
      service_id: svcRow ? input.serviceId : null,
      effective_class: decision.effectiveClass,
      class_source: decision.classSource,
      action: decision.action,
      rule: decision.rule,
      alternative_id: decision.alternative?.id ?? null,
      exception_id: decision.exceptionId,
      policy_version: decision.policyVersion,
    })
    .select("id")
    .single();
  await db.from("audit_log").insert({
    actor_id: null,
    action: "decision",
    entity: "ai_service",
    entity_id: input.serviceId,
    details: { decision_id: saved?.id ?? null, employee: me.id, action: decision.action, rule: decision.rule, class: decision.effectiveClass },
  });

  if (decision.sideEffects.markUnderReview && svcRow) {
    const row = svcRow as unknown as ServiceRow;
    await db.from("ai_services").update({ status: "under_review", ceiling: null }).eq("id", input.serviceId);
    await db.from("access_requests").insert({
      requester_id: row.owner_id ?? me.id,
      service_id: input.serviceId,
      requested_class: row.ceiling ?? 2,
      route: "medium",
      reason: "Automatic re-review: approval expired or vendor terms changed.",
      kind: "re_review",
    });
    await db.from("audit_log").insert({
      actor_id: null,
      action: "status_change",
      entity: "ai_service",
      entity_id: input.serviceId,
      details: { status: "under_review", rule: "R3" },
    });
  }
  if (decision.sideEffects.alertSecOps) {
    await db.from("audit_log").insert({
      actor_id: null,
      action: "secops_alert",
      entity: "ai_service",
      entity_id: input.serviceId,
      details: { reason: "Policy check failed; allowed for non-sensitive data", rule: "R9" },
    });
  }
  return decision;
}
