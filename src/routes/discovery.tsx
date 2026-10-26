import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { ACTION_TONE, Chip, STATUS_TONE, fmtTime } from "@/components/Chip";
import { SOURCE_LABEL, SignalForm } from "@/components/SignalForm";
import { supabase } from "@/integrations/supabase/client";
import { revealIdentityFn } from "@/lib/policy/identity.functions";
import { CLASS_NAMES, type DataClass } from "@/lib/policy/policy";

export const Route = createFileRoute("/discovery")({
  head: () => ({ meta: [{ title: "Discovery — ShadowQ" }] }),
  component: () => <AppShell>{(persona) => <Discovery roles={persona.roles} />}</AppShell>,
});

type Svc = { id: string; name: string; status: string };
type Usage = { id: number; employee_id: string; service_id: string; observed_at: string; sources: string[] };
type Dec = { id: string; at: string; employee_id: string; service_id: string | null; effective_class: number | null; action: string; rule: string };
type Priority = { service_id: string | null; name: string | null; distinct_employees: number | null };

function Discovery({ roles }: { roles: string[] }) {
  const seesAll = roles.some((r) => ["governance_lead", "secops", "privacy"].includes(r));
  const canIngest = roles.some((r) => ["governance_lead", "secops"].includes(r));
  const canReveal = roles.includes("privacy");
  const reveal = useServerFn(revealIdentityFn);

  const [services, setServices] = useState<Record<string, Svc>>({});
  const [usage, setUsage] = useState<Usage[]>([]);
  const [decisions, setDecisions] = useState<Dec[]>([]);
  const [priority, setPriority] = useState<Priority[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, u, d, p] = await Promise.all([
      supabase.from("ai_services").select("id, name, status").order("name"),
      supabase.from("usage_events").select("id, employee_id, service_id, observed_at, sources").order("observed_at", { ascending: false }).limit(100),
      supabase.from("decisions").select("id, at, employee_id, service_id, effective_class, action, rule").order("at", { ascending: false }).limit(100),
      supabase.from("priority_reviews").select("service_id, name, distinct_employees"),
    ]);
    const err = s.error ?? u.error ?? d.error ?? p.error;
    if (err) setError(err.message);
    setServices(Object.fromEntries((s.data ?? []).map((x) => [x.id, x])));
    setUsage(u.data ?? []);
    setDecisions(d.data ?? []);
    setPriority(p.data ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const name = (id: string | null) => (id ? services[id]?.name ?? id : "—");

  async function doReveal(id: string) {
    setError(null);
    try {
      const r = await reveal({ data: { employeeId: id } });
      setNames((n) => ({ ...n, [id]: r.name }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not re-identify.");
    }
  }

  const Person = ({ id }: { id: string }) => (
    <span>
      {id}
      {names[id] ? <span className="ml-1 font-medium">({names[id]})</span> : null}
      {canReveal && !names[id] ? (
        <button onClick={() => doReveal(id)} className="ml-2 text-xs underline" title="Shows the name and records this lookup in the audit log">Reveal</button>
      ) : null}
    </span>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Discovery feed</h1>
        <p className="text-sm text-muted-foreground">
          AI use found from several independent signals, not from employees reporting themselves. In this demo the signals are synthetic; in production they would come from the web gateway, endpoint agent, identity provider (SSO grants) and expense system. People appear only as pseudonymous IDs{canReveal ? "; as Privacy Officer you can reveal a name, and each reveal is written to the audit log" : "; only the Privacy Officer can see who is behind an ID, and every lookup is logged"}.
        </p>
        {!seesAll ? <p className="mt-2 text-sm text-amber-800">You are signed in as an employee, so you see only your own activity. Sign in as Priya (Governance Lead) to see everyone's.</p> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {canIngest ? <SignalForm services={Object.values(services).map((s) => ({ id: s.id, name: s.name }))} onDone={() => void load()} /> : null}

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Priority reviews</h2>
        {priority.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing flagged. A tool is flagged when 5 or more different people are coached or redirected on it within 7 days.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {priority.map((p) => (
              <li key={p.service_id} className="rounded-lg border border-amber-600 bg-amber-50 p-3 text-amber-900">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm">{p.distinct_employees} different people in the last 7 days. Demand is high enough to review it for approval.</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Usage found</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2">When</th><th className="p-2">Person</th><th className="p-2">Tool</th><th className="p-2">Seen by</th></tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-2 whitespace-nowrap">{fmtTime(u.observed_at)}</td>
                  <td className="p-2"><Person id={u.employee_id} /></td>
                  <td className="p-2">{name(u.service_id)} <Chip tone={STATUS_TONE[services[u.service_id]?.status ?? "unknown"]}>{(services[u.service_id]?.status ?? "unknown").replace("_", " ")}</Chip></td>
                  <td className="p-2"><div className="flex flex-wrap gap-1">{u.sources.map((s) => <Chip key={s}>{SOURCE_LABEL[s] ?? s}</Chip>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">What the policy decided</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2">When</th><th className="p-2">Person</th><th className="p-2">Tool</th><th className="p-2">Data</th><th className="p-2">Decision</th><th className="p-2">Rule</th></tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-2 whitespace-nowrap">{fmtTime(d.at)}</td>
                  <td className="p-2"><Person id={d.employee_id} /></td>
                  <td className="p-2">{name(d.service_id)}</td>
                  <td className="p-2">{d.effective_class ? CLASS_NAMES[d.effective_class as DataClass] : "—"}</td>
                  <td className="p-2"><Chip tone={ACTION_TONE[d.action]}>{d.action.replace(/_/g, " ")}</Chip></td>
                  <td className="p-2">{d.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
