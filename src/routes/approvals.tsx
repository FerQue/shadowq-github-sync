import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Chip, RISK_TONE, fmtDate } from "@/components/Chip";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CLASS_NAMES, ROUTES, type DataClass, type Route as PolicyRoute } from "@/lib/policy/policy";

export const Route = createFileRoute("/approvals")({
  head: () => ({ meta: [{ title: "Approvals — ShadowQ" }] }),
  component: () => <AppShell>{(persona) => <Approvals meId={persona.id} roles={persona.roles} />}</AppShell>,
});

type AppRole = Database["public"]["Enums"]["app_role"];
type Req = {
  id: string; requester_id: string; service_id: string; requested_class: number; route: PolicyRoute;
  reason: string; kind: string; status: string; submitted_at: string; duration_days: number | null;
};
type Signed = { request_id: string; approver_id: string; role: string; decision: string };

const ROLE_LABEL: Record<string, string> = {
  manager: "Manager", governance_lead: "AI Governance Lead", security: "Security", privacy: "Privacy",
};

function Approvals({ meId, roles }: { meId: string; roles: string[] }) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [signed, setSigned] = useState<Signed[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [overdue, setOverdue] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, a, s, o] = await Promise.all([
      supabase.from("access_requests").select("*").order("submitted_at"),
      supabase.from("approvals").select("request_id, approver_id, role, decision"),
      supabase.from("ai_services").select("id, name"),
      supabase.from("overdue_requests").select("id"),
    ]);
    const err = r.error ?? a.error ?? s.error;
    if (err) setError(err.message);
    setReqs((r.data ?? []) as unknown as Req[]);
    setSigned((a.data ?? []) as Signed[]);
    setNames(Object.fromEntries((s.data ?? []).map((x) => [x.id, x.name])));
    setOverdue(new Set((o.data ?? []).map((x) => x.id as string)));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function sign(req: Req, role: string, decision: "approve" | "reject") {
    setBusy(req.id + role + decision);
    setError(null);
    const { error: err } = await supabase.rpc("sign_request", { p_request_id: req.id, p_role: role as AppRole, p_decision: decision });
    setBusy(null);
    if (err) setError(err.message);
    else await load();
  }

  const open = reqs.filter((r) => r.status === "open");
  const closed = reqs.filter((r) => r.status !== "open");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Requests for an AI tool to be approved. Low-risk requests need the requester's manager; medium needs the AI Governance Lead; high needs Governance, Security and Privacy. Nobody can approve their own request, and each role signs once.
        </p>
      </div>
      {error ? <p role="alert" className="rounded-md border border-red-600 bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Open ({open.length})</h2>
        {open.length === 0 ? <p className="text-sm text-muted-foreground">No open requests are routed to you.</p> : null}
        {open.map((r) => {
          const needed = ROUTES[r.route].approvers;
          const mine = signed.filter((s) => s.request_id === r.id);
          const canSignAs = needed.filter((role) => roles.includes(role) && !mine.some((s) => s.role === role));
          return (
            <article key={r.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{r.id} · {names[r.service_id] ?? r.service_id}</h3>
                <Chip tone={RISK_TONE[r.route]}>{r.route} route</Chip>
                <Chip>{r.kind === "re_review" ? "re-review" : "access request"}</Chip>
                {overdue.has(r.id) ? <Chip tone="red">Overdue — escalated to CISO office</Chip> : <Chip tone="grey">target {ROUTES[r.route].targetBusinessDays} business day(s)</Chip>}
              </div>
              <p className="text-sm">{r.reason}</p>
              <p className="text-xs text-muted-foreground">
                From {r.requester_id} · wants {CLASS_NAMES[r.requested_class as DataClass]} data · submitted {fmtDate(r.submitted_at)}
              </p>
              <p className="text-sm">
                Signatures:{" "}
                {needed.map((role) => {
                  const s = mine.find((m) => m.role === role);
                  return <Chip key={role} tone={s ? "green" : "grey"}>{ROLE_LABEL[role] ?? role}: {s ? `${s.decision}d by ${s.approver_id}` : "waiting"}</Chip>;
                })}
              </p>
              {r.requester_id === meId ? <p className="text-xs text-amber-800">This is your own request, so you can't sign it.</p> : null}
              {canSignAs.length > 0 && r.requester_id !== meId ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {canSignAs.map((role) => (
                    <span key={role} className="flex gap-1">
                      <button disabled={busy !== null} onClick={() => sign(r, role, "approve")} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-60">
                        Approve as {ROLE_LABEL[role] ?? role}
                      </button>
                      <button disabled={busy !== null} onClick={() => sign(r, role, "reject")} className="rounded-md border border-input px-3 py-1 text-sm disabled:opacity-60">
                        Reject
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      {closed.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Decided</h2>
          <ul className="space-y-1 text-sm">
            {closed.map((r) => (
              <li key={r.id}>{r.id} · {names[r.service_id] ?? r.service_id} · <Chip tone={r.status === "approved" ? "green" : "red"}>{r.status}</Chip></li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
