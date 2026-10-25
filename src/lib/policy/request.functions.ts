// File an access request for an AI tool. The route (who must sign) is worked out on the server
// from the tool's risk tier and the data class, so the browser can't pick an easier route.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { routeFor, type DataClass, type RiskTier } from "./policy";

const inputSchema = z.object({
  serviceId: z.string().min(1).max(64),
  requestedClass: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reason: z.string().trim().min(5).max(500),
});

export const fileRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { data: me } = await db.from("employees").select("id").eq("auth_user_id", context.userId).maybeSingle();
    if (!me) throw new Error("No employee record is linked to this login. Choose a demo persona first.");

    const { data: svc } = await db.from("ai_services").select("id, name, risk_tier").eq("id", data.serviceId).maybeSingle();
    if (!svc) throw new Error("Unknown AI tool.");

    const route = routeFor(svc.risk_tier as RiskTier, data.requestedClass as DataClass);
    const { data: req, error } = await db
      .from("access_requests")
      .insert({
        requester_id: me.id,
        service_id: svc.id,
        requested_class: data.requestedClass,
        route,
        reason: data.reason,
        kind: "access",
      })
      .select("id")
      .single();
    if (error || !req) throw new Error(error?.message ?? "Could not file the request.");

    await db.from("audit_log").insert({
      actor_id: me.id,
      action: "request_filed",
      entity: "access_request",
      entity_id: req.id,
      details: { service: svc.id, class: data.requestedClass, route },
    });

    return { id: req.id, route, serviceName: svc.name };
  });
