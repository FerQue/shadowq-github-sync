// Signal ingest: takes one synthetic enterprise signal (SSO grant, web gateway, expense line or endpoint
// inventory), normalizes it into a usage event, merges duplicates, adds unseen tools to the registry as
// Unknown, and runs the policy engine. In production the same function would be fed by real connectors.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SOURCES = ["sso_grant", "gateway", "expense", "endpoint"] as const;
const DEDUPE_MINUTES = 15;

const inputSchema = z
  .object({
    source: z.enum(SOURCES),
    employeeId: z.string().regex(/^E-\d{4}$/),
    serviceId: z.string().min(1).max(64).optional(),
    newToolName: z.string().trim().min(2).max(60).optional(),
  })
  .refine((d) => (d.serviceId === undefined) !== (d.newToolName === undefined), {
    message: "Choose a tool from the registry or enter a new tool name.",
  });

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const ingestSignalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { decideAndRecord } = await import("./decide.server");
    const now = new Date();

    // Only the people who run the collectors may feed signals in.
    const { data: caller } = await db.from("employees").select("id").eq("auth_user_id", context.userId).maybeSingle();
    if (!caller) throw new Error("No employee record is linked to this login. Choose a demo persona first.");
    const { data: roles } = await db.from("user_roles").select("role").eq("employee_id", caller.id);
    if (!(roles ?? []).some((r) => r.role === "governance_lead" || r.role === "secops")) {
      throw new Error("Only the AI Governance Lead or Security Operations can feed signals in.");
    }

    const { data: subject } = await db.from("employees").select("id").eq("id", data.employeeId).maybeSingle();
    if (!subject) throw new Error("Unknown employee ID.");

    // Resolve the tool. A tool never seen before is added to the registry as Unknown (first detection).
    let serviceId = data.serviceId ?? "";
    let serviceName = "";
    let created = false;
    if (data.serviceId !== undefined) {
      const { data: svc } = await db.from("ai_services").select("id, name").eq("id", data.serviceId).maybeSingle();
      if (!svc) throw new Error("Unknown tool.");
      serviceName = svc.name;
    } else if (data.newToolName !== undefined) {
      const { data: existing } = await db.from("ai_services").select("id, name").ilike("name", escapeLike(data.newToolName)).maybeSingle();
      if (existing) {
        serviceId = existing.id;
        serviceName = existing.name;
      } else {
        const slug = slugify(data.newToolName);
        if (!slug) throw new Error("Enter a tool name with letters or numbers.");
        serviceId = `svc-${slug}`;
        const { data: clash } = await db.from("ai_services").select("id").eq("id", serviceId).maybeSingle();
        if (clash) serviceId = `${serviceId}-${Math.random().toString(36).slice(2, 6)}`;
        const { error } = await db.from("ai_services").insert({
          id: serviceId,
          name: data.newToolName,
          vendor: "Unknown",
          category: "Detected by signal",
          status: "unknown",
          risk_tier: "high",
          first_seen_at: now.toISOString(),
        });
        if (error) throw new Error(error.message);
        serviceName = data.newToolName;
        created = true;
        await db.from("audit_log").insert({
          actor_id: caller.id,
          action: "service_detected",
          entity: "ai_service",
          entity_id: serviceId,
          details: { source: data.source, first_seen_for: data.employeeId },
        });
      }
    }

    // Raw signal, as received.
    await db.from("signals").insert({
      source: data.source,
      employee_id: data.employeeId,
      service_id: serviceId,
      observed_at: now.toISOString(),
      detail: { origin: "simulated-ingest" },
    });

    // Deduplicate: the same person and tool within a few minutes is one usage event seen by several sources.
    const since = new Date(now.getTime() - DEDUPE_MINUTES * 60_000).toISOString();
    const { data: recent } = await db
      .from("usage_events")
      .select("id, sources, observed_at")
      .eq("employee_id", data.employeeId)
      .eq("service_id", serviceId)
      .gte("observed_at", since)
      .order("observed_at", { ascending: false })
      .limit(1);
    const prior = recent?.[0];

    if (prior) {
      const sources = prior.sources.includes(data.source) ? prior.sources : [...prior.sources, data.source];
      if (sources.length !== prior.sources.length) {
        await db.from("usage_events").update({ sources }).eq("id", prior.id);
      }
      await db.from("audit_log").insert({
        actor_id: caller.id,
        action: "signal_merged",
        entity: "ai_service",
        entity_id: serviceId,
        details: { employee: data.employeeId, source: data.source, sources: sources.join("+") },
      });
      const minutesAgo = Math.max(0, Math.round((now.getTime() - new Date(prior.observed_at).getTime()) / 60_000));
      return { outcome: "merged" as const, serviceName, created, sources, minutesAgo, decision: null };
    }

    const { error: ueErr } = await db.from("usage_events").insert({
      employee_id: data.employeeId,
      service_id: serviceId,
      observed_at: now.toISOString(),
      sources: [data.source],
      declared_class: null,
    });
    if (ueErr) throw new Error(ueErr.message);

    await db.from("audit_log").insert({
      actor_id: caller.id,
      action: "signal_ingested",
      entity: "ai_service",
      entity_id: serviceId,
      details: { employee: data.employeeId, source: data.source },
    });

    const decision = await decideAndRecord(db, { employeeId: data.employeeId, serviceId, declaredClass: null, patternHit: false });
    return {
      outcome: "new" as const,
      serviceName,
      created,
      sources: [data.source] as string[],
      minutesAgo: 0,
      decision: { action: decision.action, rule: decision.rule, message: decision.message },
    };
  });
