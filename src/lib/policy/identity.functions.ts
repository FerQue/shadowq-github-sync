// Re-identification: pseudonymous IDs are shown everywhere; only the Privacy Officer can see the name
// behind one, and every reveal is written to the append-only audit log.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const revealIdentityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ employeeId: z.string().regex(/^E-\d{4}$/) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { data: caller } = await db.from("employees").select("id").eq("auth_user_id", context.userId).maybeSingle();
    if (!caller) throw new Error("No employee record is linked to this login. Choose a demo persona first.");
    const { data: roles } = await db.from("user_roles").select("role").eq("employee_id", caller.id);
    if (!(roles ?? []).some((r) => r.role === "privacy")) {
      throw new Error("Only the Privacy Officer can re-identify an employee.");
    }

    const { data: person } = await db.from("employees").select("id, display_name, department_id").eq("id", data.employeeId).maybeSingle();
    if (!person) throw new Error("Unknown employee ID.");

    // Log first-class: who looked up whom, and when.
    await db.from("audit_log").insert({
      actor_id: caller.id,
      action: "reidentify",
      entity: "employee",
      entity_id: person.id,
      details: { department: person.department_id },
    });
    return { id: person.id, name: person.display_name };
  });
