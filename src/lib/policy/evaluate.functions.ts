// evaluate-usage as a TanStack Start server function (replaces the Supabase edge function).
// The browser sends { serviceId, declaredClass?, patternHit } — never the text itself.
// Policy logic lives unchanged in ./policy.ts; this file only loads data, calls it and records the outcome.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateUsage, type DataClass, type Exception, type Service } from "./policy";

const inputSchema = z.object({
  serviceId: z.string().min(1).max(64),
  declaredClass: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable().optional(),
  patternHit: z.boolean().optional(),
});

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

export const evaluateUsageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const now = new Date();

    const { data: me } = await db
      .from("employees")
      .select("id, department_id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (!me) throw new Error("No employee record is linked to this login. Choose a demo persona first.");

    const { data: dept } = await db
      .from("departments")
      .select("default_class")
      .eq("id", me.department_id)
      .maybeSingle();
    const deptDefault = (dept?.default_class ?? null) as DataClass | null;

    // Lookups. If the service lookup fails, pass null: the engine applies R9 (fail safe).
    const { data: svcRow } = await db.from("ai_services").select("*").eq("id", data.serviceId).maybeSingle();
    const { data: catalogRows } = await db.from("ai_services").select("*").eq("status", "approved");
    const { data: exRows } = await db
      .from("exceptions")
      .select("*")
      .eq("service_id", data.serviceId)
      .or(`employee_id.eq.${me.id},department_id.eq.${me.department_id}`);

    const decision = evaluateUsage({
      employee: { id: me.id, department: me.department_id },
      service: svcRow ? toService(svcRow as unknown as ServiceRow) : null,
      declaredClass: data.declaredClass ?? null,
      departmentDefault: deptDefault,
      patternHit: !!data.patternHit,
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

    // Record it: usage event, decision, audit entry (metadata only — the pasted text is never stored).
    await db.from("usage_events").insert({
      employee_id: me.id,
      service_id: data.serviceId,
      observed_at: now.toISOString(),
      sources: ["simulator"],
      declared_class: data.declaredClass ?? null,
    });
    const { data: saved } = await db
      .from("decisions")
      .insert({
        employee_id: me.id,
        department_id: me.department_id,
        service_id: svcRow ? data.serviceId : null,
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
      entity_id: data.serviceId,
      details: {
        decision_id: saved?.id,
        employee: me.id,
        action: decision.action,
        rule: decision.rule,
        class: decision.effectiveClass,
      },
    });

    // Side effects.
    if (decision.sideEffects.markUnderReview && svcRow) {
      const row = svcRow as unknown as ServiceRow;
      await db.from("ai_services").update({ status: "under_review", ceiling: null }).eq("id", data.serviceId);
      await db.from("access_requests").insert({
        requester_id: row.owner_id ?? me.id,
        service_id: data.serviceId,
        requested_class: row.ceiling ?? 2,
        route: "medium",
        reason: "Automatic re-review: approval expired or vendor terms changed.",
        kind: "re_review",
      });
      await db.from("audit_log").insert({
        actor_id: null,
        action: "status_change",
        entity: "ai_service",
        entity_id: data.serviceId,
        details: { status: "under_review", rule: "R3" },
      });
    }
    if (decision.sideEffects.alertSecOps) {
      await db.from("audit_log").insert({
        actor_id: null,
        action: "secops_alert",
        entity: "ai_service",
        entity_id: data.serviceId,
        details: { reason: "Policy check failed; allowed for non-sensitive data", rule: "R9" },
      });
    }

    return decision;
  });
