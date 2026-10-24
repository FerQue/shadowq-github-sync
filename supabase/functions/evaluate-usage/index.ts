// supabase/functions/evaluate-usage/index.ts
// Lovable / Supabase edge function. Paste policy.ts next to this file as ./policy.ts.
// The browser sends: { serviceId, declaredClass?, patternHit } — never the text itself.
import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateUsage, type DataClass, type Service, type Exception } from "./policy.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type ServiceRow = {
  id: string; name: string; status: Service["status"]; ceiling: DataClass | null; risk_tier: Service["riskTier"];
  kill_switch: boolean; expires_at: string | null; vendor_changed: boolean; is_default_alternative: boolean;
};
const toService = (r: ServiceRow): Service => ({
  id: r.id, name: r.name, status: r.status, ceiling: r.ceiling, riskTier: r.risk_tier, killSwitch: r.kill_switch,
  expiresAt: r.expires_at, vendorChanged: r.vendor_changed, isDefaultAlternative: r.is_default_alternative,
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Who is asking? Verify the caller's login, then use the service role for reads and writes.
  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth.user) return json({ error: "Sign in first." }, 401);
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const body = await req.json() as { serviceId: string; declaredClass?: DataClass | null; patternHit?: boolean };
  const now = new Date();

  const { data: me } = await db.from("employees").select("id, department_id, departments(default_class)")
    .eq("auth_user_id", auth.user.id).single();
  if (!me) return json({ error: "No employee record is linked to this login." }, 403);
  const deptDefault = (me.departments as unknown as { default_class: DataClass } | null)?.default_class ?? null;

  // Lookups. If the service lookup fails, pass null: the engine applies R9 (fail safe).
  const { data: svcRow } = await db.from("ai_services").select("*").eq("id", body.serviceId).maybeSingle();
  const { data: catalogRows } = await db.from("ai_services").select("*").eq("status", "approved");
  const { data: exRows } = await db.from("exceptions").select("*").eq("service_id", body.serviceId)
    .or(`employee_id.eq.${me.id},department_id.eq.${me.department_id}`);

  const decision = evaluateUsage({
    employee: { id: me.id, department: me.department_id },
    service: svcRow ? toService(svcRow as ServiceRow) : null,
    declaredClass: body.declaredClass ?? null,
    departmentDefault: deptDefault,
    patternHit: !!body.patternHit,
    exceptions: (exRows ?? []).map((e): Exception => ({ id: e.id, serviceId: e.service_id, employeeId: e.employee_id ?? undefined,
      department: e.department_id ?? undefined, maxClass: e.max_class, expiresAt: e.expires_at })),
    catalog: (catalogRows ?? []).map(r => toService(r as ServiceRow)),
    now,
  });

  // Record it: usage event, decision, audit entry (metadata only).
  await db.from("usage_events").insert({ employee_id: me.id, service_id: body.serviceId, observed_at: now.toISOString(),
    sources: ["simulator"], declared_class: body.declaredClass ?? null });
  const { data: saved } = await db.from("decisions").insert({
    employee_id: me.id, department_id: me.department_id, service_id: svcRow ? body.serviceId : null,
    effective_class: decision.effectiveClass, class_source: decision.classSource, action: decision.action, rule: decision.rule,
    alternative_id: decision.alternative?.id ?? null, exception_id: decision.exceptionId, policy_version: decision.policyVersion,
  }).select("id").single();
  await db.from("audit_log").insert({ actor_id: null, action: "decision", entity: "ai_service", entity_id: body.serviceId,
    details: { decision_id: saved?.id, employee: me.id, action: decision.action, rule: decision.rule, class: decision.effectiveClass } });

  // Side effects.
  if (decision.sideEffects.markUnderReview && svcRow) {
    await db.from("ai_services").update({ status: "under_review", ceiling: null }).eq("id", body.serviceId);
    await db.from("access_requests").insert({ requester_id: (svcRow as { owner_id: string | null }).owner_id ?? me.id,
      service_id: body.serviceId, requested_class: (svcRow as ServiceRow).ceiling ?? 2, route: "medium",
      reason: "Automatic re-review: approval expired or vendor terms changed.", kind: "re_review" });
    await db.from("audit_log").insert({ actor_id: null, action: "status_change", entity: "ai_service", entity_id: body.serviceId,
      details: { status: "under_review", rule: "R3" } });
  }
  if (decision.sideEffects.alertSecOps) {
    await db.from("audit_log").insert({ actor_id: null, action: "secops_alert", entity: "ai_service", entity_id: body.serviceId,
      details: { reason: "Policy check failed; allowed for non-sensitive data", rule: "R9" } });
  }
  return json(decision);
});
