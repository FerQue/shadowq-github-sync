import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Chip, fmtTime } from "@/components/Chip";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit log — ShadowQ" }] }),
  component: () => <AppShell>{(persona) => <Audit allowed={persona.roles.some((r) => ["governance_lead", "privacy"].includes(r))} />}</AppShell>,
});

type Row = { id: number; at: string; actor_id: string | null; action: string; entity: string; entity_id: string; details: Record<string, unknown> };

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function Audit({ allowed }: { allowed: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [action, setAction] = useState("all");
  const [entityId, setEntityId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    supabase
      .from("audit_log")
      .select("id, at, actor_id, action, entity, entity_id, details")
      .order("at", { ascending: false })
      .limit(500)
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data ?? []) as unknown as Row[]);
      });
  }, [allowed]);

  const actions = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.action)))], [rows]);
  const shown = rows.filter((r) => (action === "all" || r.action === action) && (!entityId || r.entity_id.toLowerCase().includes(entityId.toLowerCase())));

  function exportCsv() {
    const lines = [["time", "actor", "action", "entity", "entity_id", "details"].join(",")].concat(
      shown.map((r) => [r.at, r.actor_id ?? "system", r.action, r.entity, r.entity_id, JSON.stringify(r.details)].map(csvCell).join(",")),
    );
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shadowq-audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!allowed) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">The audit log is visible only to the AI Governance Lead and the Privacy Officer. Sign in as Priya or Amira to see it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          This log is append-only: the database rejects any edit or delete, including by administrators using the app. It stores IDs and decisions, never the text people typed.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label>
          Action{" "}
          <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label>
          Tool or request ID{" "}
          <input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="e.g. svc-draftpal" className="rounded-md border border-input bg-background px-2 py-1" />
        </label>
        <button onClick={exportCsv} className="rounded-md border border-input px-3 py-1 hover:bg-accent">Export CSV</button>
        <span className="text-muted-foreground">{shown.length} entries</span>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-2">Time</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Entity</th><th className="p-2">Details</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-2 whitespace-nowrap">{fmtTime(r.at)}</td>
                <td className="p-2">{r.actor_id ?? "system"}</td>
                <td className="p-2">{r.action.replace(/_/g, " ")}</td>
                <td className="p-2">{r.entity_id}</td>
                <td className="p-2"><div className="flex flex-wrap gap-1">{Object.entries(r.details ?? {}).map(([k, v]) => <Chip key={k}>{k}: {String(v)}</Chip>)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
