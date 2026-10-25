import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Chip, RISK_TONE, STATUS_TONE, fmtDate } from "@/components/Chip";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CLASS_NAMES, type DataClass } from "@/lib/policy/policy";

export const Route = createFileRoute("/registry")({
  head: () => ({ meta: [{ title: "AI registry — ShadowQ" }] }),
  component: () => <AppShell>{(persona) => <Registry roles={persona.roles} />}</AppShell>,
});

type Svc = Database["public"]["Tables"]["ai_services"]["Row"];
const yn = (v: boolean | null) => (v === null ? "unknown" : v ? "yes" : "no");

function Registry({ roles }: { roles: string[] }) {
  const [rows, setRows] = useState<Svc[]>([]);
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const canKill = roles.includes("secops") || roles.includes("governance_lead");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("ai_services").select("*").order("name");
    if (err) setError(err.message);
    else setRows(data ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggleKill(s: Svc) {
    setError(null);
    const { error: err } = await supabase.rpc("set_kill_switch", { p_service_id: s.id, p_on: !s.kill_switch });
    if (err) setError(err.message);
    else await load();
  }

  const now = Date.now();
  const shown = rows.filter((r) => (status === "all" || r.status === status) && (risk === "all" || r.risk_tier === risk));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">AI registry</h1>
        <p className="text-sm text-muted-foreground">
          Every AI service seen at Northbridge, what it is approved for, and who owns it. The ceiling is the highest data class the tool may handle.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label>
          Status{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            {["all", "approved", "under_review", "unknown", "prohibited"].map((v) => (
              <option key={v} value={v}>{v.replace("_", " ")}</option>
            ))}
          </select>
        </label>
        <label>
          Risk{" "}
          <select value={risk} onChange={(e) => setRisk(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            {["all", "low", "medium", "high"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <span className="text-muted-foreground">{shown.length} of {rows.length} tools</span>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2">Tool</th><th className="p-2">Status</th><th className="p-2">Ceiling</th>
              <th className="p-2">Risk</th><th className="p-2">Expires</th><th className="p-2">Switch</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const expired = !!s.expires_at && new Date(s.expires_at).getTime() < now;
              return (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="p-2">
                    <details>
                      <summary className="cursor-pointer font-medium">{s.name}</summary>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <dt>Vendor</dt><dd>{s.vendor ?? "—"}</dd>
                        <dt>Category</dt><dd>{s.category ?? "—"}{s.embedded_in ? ` (inside ${s.embedded_in})` : ""}</dd>
                        <dt>Trains on inputs</dt><dd>{yn(s.trains_on_inputs)}</dd>
                        <dt>Data agreement</dt><dd>{yn(s.has_dpa)}</dd>
                        <dt>Retention</dt><dd>{s.retention_days === null ? "unknown" : `${s.retention_days} days`}</dd>
                        <dt>Data region</dt><dd>{s.data_region ?? "unknown"}</dd>
                        <dt>Security assurance</dt><dd>{yn(s.has_assurance)}</dd>
                        <dt>SSO and audit logs</dt><dd>{yn(s.sso_and_audit_logs)}</dd>
                        <dt>Acts as an agent</dt><dd>{yn(s.agentic)}</dd>
                        <dt>Owner</dt><dd>{s.owner_id ?? "none"}</dd>
                        <dt>Conditions</dt><dd>{s.conditions ?? "—"}</dd>
                        <dt>First seen</dt><dd>{fmtDate(s.first_seen_at)}</dd>
                      </dl>
                    </details>
                  </td>
                  <td className="p-2"><Chip tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ")}</Chip></td>
                  <td className="p-2">{s.ceiling ? CLASS_NAMES[s.ceiling as DataClass] : "—"}</td>
                  <td className="p-2"><Chip tone={RISK_TONE[s.risk_tier]}>{s.risk_tier}</Chip></td>
                  <td className={`p-2 ${expired ? "font-medium text-red-700" : ""}`}>{fmtDate(s.expires_at)}{expired ? " (expired)" : ""}</td>
                  <td className="p-2">
                    {s.kill_switch ? <Chip tone="red">OFF</Chip> : <Chip tone="grey">on</Chip>}
                    {canKill ? (
                      <button onClick={() => toggleKill(s)} className="ml-2 text-xs underline">
                        {s.kill_switch ? "Turn back on" : "Switch off"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
