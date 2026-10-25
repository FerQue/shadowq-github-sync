import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ACTION_TONE, Chip, RISK_TONE, STATUS_TONE } from "@/components/Chip";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_NAMES, type DataClass } from "@/lib/policy/policy";

export const Route = createFileRoute("/overview")({
  head: () => ({ meta: [{ title: "Overview — ShadowQ" }] }),
  component: () => <AppShell>{(persona) => <Overview seesAll={persona.roles.some((r) => ["governance_lead", "secops", "privacy"].includes(r))} />}</AppShell>,
});

type Svc = { id: string; name: string; status: string; risk_tier: string };
type Dec = { service_id: string | null; effective_class: number | null; action: string; employee_id: string };
type Usage = { service_id: string; sources: string[] };
type Req = { status: string; submitted_at: string; decided_at: string | null; route: string };

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const middle = s[m];
  if (middle === undefined) return null;
  if (s.length % 2) return middle;
  const previous = s[m - 1];
  if (previous === undefined) return null;
  return (previous + middle) / 2;
};

function Tile({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Overview({ seesAll }: { seesAll: boolean }) {
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [decs, setDecs] = useState<Dec[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [s, d, u, r, o] = await Promise.all([
        supabase.from("ai_services").select("id, name, status, risk_tier"),
        supabase.from("decisions").select("service_id, effective_class, action, employee_id").limit(2000),
        supabase.from("usage_events").select("service_id, sources").limit(2000),
        supabase.from("access_requests").select("status, submitted_at, decided_at, route"),
        supabase.from("overdue_requests").select("id"),
      ]);
      const err = s.error ?? d.error ?? u.error ?? r.error;
      if (err) setError(err.message);
      setSvcs(s.data ?? []);
      setDecs(d.data ?? []);
      setUsage(u.data ?? []);
      setReqs((r.data ?? []) as Req[]);
      setOverdue((o.data ?? []).length);
    })();
  }, []);

  const byId = Object.fromEntries(svcs.map((s) => [s.id, s]));

  // Visibility: of the tools actually seen in use, how many does governance already know about?
  const inUse = Array.from(new Set(usage.map((x) => x.service_id)));
  const known = inUse.filter((id) => byId[id] && byId[id].status !== "unknown").length;
  const multi = usage.filter((x) => x.sources.length > 1).length;

  // Decisions
  const counts: Record<string, number> = {};
  decs.forEach((x) => (counts[x.action] = (counts[x.action] ?? 0) + 1));
  const maxCount = Math.max(1, ...Object.values(counts));
  const sensitiveStopped = decs.filter((x) => (x.effective_class ?? 0) >= 3 && ["redirect", "block", "request_approval"].includes(x.action)).length;
  const sensitiveUnsanctioned = decs.filter((x) => (x.effective_class ?? 0) >= 3 && x.service_id && byId[x.service_id]?.status !== "approved").length;
  const redirects = counts["redirect"] ?? 0;

  // Time to decision
  const hours = reqs.filter((x) => x.decided_at).map((x) => (new Date(x.decided_at as string).getTime() - new Date(x.submitted_at).getTime()) / 3_600_000);
  const med = median(hours);
  const open = reqs.filter((x) => x.status === "open").length;

  // Top risky tools: most coach / redirect / block decisions
  const perTool: Record<string, { n: number; people: Set<string> }> = {};
  decs.forEach((x) => {
    if (!x.service_id || !["coach", "redirect", "block", "request_approval"].includes(x.action)) return;
    const e = (perTool[x.service_id] ??= { n: 0, people: new Set() });
    e.n += 1;
    e.people.add(x.employee_id);
  });
  const top = Object.entries(perTool).sort((a, b) => b[1].n - a[1].n).slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          How well Northbridge can see and control AI use. These figures are calculated live from the discovery signals, policy decisions and approval requests, using synthetic data.
        </p>
        {!seesAll ? <p className="mt-2 text-sm text-amber-800">You are signed in as an employee, so these totals cover only your own activity. Sign in as Priya (Governance Lead) for the organization-wide view.</p> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Tools seen in use" value={inUse.length} note={`${known} of ${inUse.length} already known to governance (not "unknown")`} />
        <Tile label="Usage seen by 2+ signals" value={usage.length ? `${Math.round((multi / usage.length) * 100)}%` : "—"} note="Share of usage events confirmed by more than one independent source" />
        <Tile label="Sensitive uses stopped or redirected" value={sensitiveStopped} note="Confidential or Restricted data redirected, blocked or sent for approval" />
        <Tile label="Sensitive uses on unsanctioned tools" value={sensitiveUnsanctioned} note="Confidential or Restricted data on tools that were not approved" />
        <Tile label="Median time to decision" value={med === null ? "—" : med < 48 ? `${med.toFixed(1)} h` : `${(med / 24).toFixed(1)} days`} note={`${hours.length} decided request(s). Targets: low 1, medium 2, high 5 business days`} />
        <Tile label="Open requests" value={open} note={`${overdue} overdue and escalated to the CISO office`} />
        <Tile label="Redirects issued" value={redirects} note="Employees pointed to an approved tool. Whether they then used it is not measured in this MVP." />
        <Tile label="Decisions made" value={decs.length} note="Every one is recorded with the rule that fired" />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Decisions by action</h2>
        <div className="space-y-1 rounded-lg border border-border bg-card p-4">
          {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([action, n]) => (
            <div key={action} className="flex items-center gap-3 text-sm">
              <span className="w-36"><Chip tone={ACTION_TONE[action]}>{action.replace(/_/g, " ")}</Chip></span>
              <div className="h-3 flex-1 rounded bg-muted"><div className="h-3 rounded bg-primary" style={{ width: `${(n / maxCount) * 100}%` }} /></div>
              <span className="w-8 text-right tabular-nums">{n}</span>
            </div>
          ))}
          {decs.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet. Try the simulator.</p> : null}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Top tools needing attention</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2">Tool</th><th className="p-2">Status</th><th className="p-2">Risk</th><th className="p-2">Interventions</th><th className="p-2">Different people</th></tr>
            </thead>
            <tbody>
              {top.map(([id, e]) => (
                <tr key={id} className="border-t border-border">
                  <td className="p-2 font-medium">{byId[id]?.name ?? id}</td>
                  <td className="p-2"><Chip tone={STATUS_TONE[byId[id]?.status ?? "unknown"]}>{(byId[id]?.status ?? "unknown").replace("_", " ")}</Chip></td>
                  <td className="p-2"><Chip tone={RISK_TONE[byId[id]?.risk_tier ?? "high"]}>{byId[id]?.risk_tier ?? "—"}</Chip></td>
                  <td className="p-2 tabular-nums">{e.n}</td>
                  <td className="p-2 tabular-nums">{e.people.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Interventions are coach, redirect, request-approval and block decisions. Highest first: this is the review queue order. Data classes: {([1, 2, 3, 4] as DataClass[]).map((c) => CLASS_NAMES[c]).join(", ")}.</p>
      </section>
    </div>
  );
}
