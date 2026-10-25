import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ACTION_TONE, Chip } from "@/components/Chip";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_NAMES, POLICY_VERSION, ROUTES, evaluateUsage, type DataClass, type Service } from "@/lib/policy/policy";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [{ title: "Policy rules — ShadowQ" }] }),
  component: () => <AppShell>{() => <Rules />}</AppShell>,
});

const RULES: [string, string, string][] = [
  ["R0", "Kill switch is on for the tool", "Block"],
  ["R1", "Tool is prohibited", "Block, show the approved alternative"],
  ["R2", "An active exception for this person or department covers the data class", "Allow (logged as an exception)"],
  ["R3", "Approval has expired, or vendor terms or the model changed", "Set the tool to under review, queue a re-review, then continue to R4–R7"],
  ["R4", "Tool is approved and the data class is within its ceiling", "Allow"],
  ["R5", "Data class is above the ceiling (or there is none) and is Confidential or lower", "Redirect if an approved alternative exists, otherwise request approval"],
  ["R6", "Data class is Restricted and above the ceiling", "Block"],
  ["R7", "Tool has no ceiling and the data class is Public or Internal", "Coach"],
  ["R9", "The policy check itself fails or data is missing", "Block for Confidential or Restricted data; otherwise allow and alert Security Operations"],
];

const ROW_LABEL = ["Approved up to Public", "Approved up to Internal", "Approved up to Confidential", "Approved up to Restricted (none in the demo)", "Under review", "Unknown", "Prohibited"];

const FAR = "2099-01-01T00:00:00Z";
const base = (id: string, o: Partial<Service>): Service => ({
  id, name: id, status: "unknown", ceiling: null, riskTier: "low", killSwitch: false, expiresAt: null, vendorChanged: false, ...o,
});

function Rules() {
  const [depts, setDepts] = useState<{ id: string; name: string; default_class: number }[]>([]);
  useEffect(() => {
    supabase.from("departments").select("id, name, default_class").order("name").then(({ data }) => setDepts(data ?? []));
  }, []);

  // The matrix is produced by running the real policy engine, so it can't drift from the rules above.
  const matrix = useMemo(() => {
    const alt = base("alt", { status: "approved", ceiling: 3, expiresAt: FAR, isDefaultAlternative: true });
    const rows: Service[] = [
      base("row", { status: "approved", ceiling: 1, expiresAt: FAR }),
      base("row", { status: "approved", ceiling: 2, expiresAt: FAR }),
      base("row", { status: "approved", ceiling: 3, expiresAt: FAR }),
      base("row", { status: "approved", ceiling: 4, expiresAt: FAR }),
      base("row", { status: "under_review" }),
      base("row", { status: "unknown" }),
      base("row", { status: "prohibited" }),
    ];
    const now = new Date();
    return rows.map((svc) =>
      ([1, 2, 3, 4] as DataClass[]).map((c) =>
        evaluateUsage({ employee: { id: "demo", department: "demo" }, service: svc, declaredClass: c, departmentDefault: c, patternHit: false, exceptions: [], catalog: [alt], now }),
      ),
    );
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Policy rules</h1>
        <p className="text-sm text-muted-foreground">
          Version {POLICY_VERSION}. Every AI use is decided by one deterministic function that compares the data class of the work with the ceiling the tool is approved for. No language model takes part in a decision. This page is read-only: changing a rule is a controlled change to the policy code and is recorded with the policy version.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Rules, in the order they run (first match decides)</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2">Rule</th><th className="p-2">When</th><th className="p-2">Then</th></tr>
            </thead>
            <tbody>
              {RULES.map(([r, w, t]) => (
                <tr key={r} className="border-t border-border align-top">
                  <td className="p-2 font-medium">{r}</td><td className="p-2">{w}</td><td className="p-2">{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Safety overrides (kill switch, prohibition) run first, so no exception or approval can get around them.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">What the rules produce</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2">Tool is…</th>{([1, 2, 3, 4] as DataClass[]).map((c) => <th key={c} className="p-2">{CLASS_NAMES[c]} data</th>)}</tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={ROW_LABEL[i]} className="border-t border-border">
                  <td className="p-2 font-medium">{ROW_LABEL[i]}</td>
                  {row.map((d, j) => (
                    <td key={j} className="p-2">
                      <Chip tone={ACTION_TONE[d.action]}>{d.action.replace(/_/g, " ")}</Chip>
                      <span className="ml-1 text-xs text-muted-foreground">{d.rule}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Generated by running the live policy engine, with Northbridge Assistant (approved up to Confidential) as the approved alternative. Without an approved alternative, "redirect" becomes "request approval".
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Department default data class</h2>
          <p className="text-sm text-muted-foreground">Used when an employee doesn't pick a label. A label can lower the default, but a sensitive-number pattern always raises it to Restricted.</p>
          <ul className="space-y-1 text-sm">
            {depts.map((d) => (
              <li key={d.id} className="flex justify-between rounded border border-border bg-card px-3 py-1.5"><span>{d.name}</span><span className="text-muted-foreground">{CLASS_NAMES[d.default_class as DataClass]}</span></li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Who approves, and how fast</h2>
          <p className="text-sm text-muted-foreground">The higher of the tool's risk tier and the requested data class sets the route. Nobody approves their own request, and each role signs once.</p>
          <ul className="space-y-1 text-sm">
            {(Object.keys(ROUTES) as (keyof typeof ROUTES)[]).map((k) => (
              <li key={k} className="rounded border border-border bg-card px-3 py-1.5">
                <span className="font-medium capitalize">{k} route</span>: {ROUTES[k].approvers.map((a) => a.replace("_", " ")).join(" + ")}. Target {ROUTES[k].targetBusinessDays} business day(s); approval lasts {ROUTES[k].defaultExpiryDays} days by default; escalates to the CISO office if late.
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
