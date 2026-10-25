import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { evaluateUsageFn } from "@/lib/policy/evaluate.functions";
import { fileRequestFn } from "@/lib/policy/request.functions";
import { CLASS_NAMES, detectRestricted, type DataClass, type Decision } from "@/lib/policy/policy";

export const Route = createFileRoute("/simulator")({
  head: () => ({ meta: [{ title: "Simulator — ShadowQ" }] }),
  component: () => <AppShell>{(persona) => <Simulator employeeName={persona.display_name} />}</AppShell>,
});

type ServiceOption = { id: string; name: string; status: string; category: string | null };

const ACTION_STYLE: Record<string, string> = {
  allow: "border-green-600 bg-green-50 text-green-900",
  allow_with_alert: "border-green-600 bg-green-50 text-green-900",
  coach: "border-amber-600 bg-amber-50 text-amber-900",
  redirect: "border-amber-600 bg-amber-50 text-amber-900",
  request_approval: "border-amber-600 bg-amber-50 text-amber-900",
  block: "border-red-600 bg-red-50 text-red-900",
};

function Simulator({ employeeName }: { employeeName: string }) {
  const evaluate = useServerFn(evaluateUsageFn);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [declared, setDeclared] = useState<DataClass | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  useEffect(() => {
    supabase
      .from("ai_services")
      .select("id, name, status, category")
      .order("name")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else {
          setServices(data ?? []);
          const first = data?.[0];
          if (first) setServiceId(first.id);
        }
      });
  }, []);

  // Runs in the browser: only the true/false result is sent to the server, never the text.
  const pattern = detectRestricted(text);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setDecision(await evaluate({ data: { serviceId, declaredClass: declared, patternHit: pattern.hit } }));
    } catch (e) {
      setDecision(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Try an AI tool</h1>
          <p className="text-sm text-muted-foreground">
            Acting as {employeeName}. Pick a tool and what kind of data you are about to use. The decision is made by the policy engine on the server and recorded in the audit log.
          </p>
        </div>

        <label className="block text-sm font-medium">
          AI tool
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-normal">
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.status.replace("_", " ")}</option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-sm font-medium">What kind of data?</span>
          <div className="mt-1 grid grid-cols-5 overflow-hidden rounded-md border border-input text-sm">
            <button onClick={() => setDeclared(null)} className={`px-2 py-2 ${declared === null ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
              Not sure
            </button>
            {([1, 2, 3, 4] as DataClass[]).map((c) => (
              <button key={c} onClick={() => setDeclared(c)}
                className={`border-l border-input px-2 py-2 ${declared === c ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                {CLASS_NAMES[c]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">"Not sure" uses your department's default class.</p>
        </div>

        <label className="block text-sm font-medium">
          Text about to be pasted <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder="Try: Client SIN 046 454 286 asked about a fee"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-normal" />
        </label>
        <p className="text-xs text-muted-foreground">
          {text ? (pattern.hit ? `Pattern check found: ${pattern.kinds.join(", ")}. Treated as Restricted.` : "Pattern check found nothing.") : "Pattern check looks for SIN, card and bank account numbers in your browser. The text is never sent."}
        </p>

        <button onClick={run} disabled={busy || !serviceId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Checking…" : "Check this use"}
        </button>
      </section>

      <section aria-live="polite">
        {error ? <p role="alert" className="rounded-md border border-red-600 bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}
        {decision ? (
          <div className={`space-y-3 rounded-lg border-l-4 p-5 ${ACTION_STYLE[decision.action] ?? ""}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
              <span>{decision.action.replace(/_/g, " ")}</span>
              <span className="rounded bg-black/10 px-2 py-0.5">Rule {decision.rule}</span>
            </div>
            <p className="text-lg font-medium">{decision.message}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="opacity-70">Data class</dt>
              <dd>{decision.effectiveClass ? `${CLASS_NAMES[decision.effectiveClass]} (${decision.classSource?.replace(/_/g, " ")})` : "unknown"}</dd>
              <dt className="opacity-70">Approved alternative</dt>
              <dd>{decision.alternative?.name ?? "none"}</dd>
              <dt className="opacity-70">Policy version</dt>
              <dd>{decision.policyVersion}</dd>
            </dl>
            {decision.sideEffects.markUnderReview ? <p className="text-sm">This tool's approval has lapsed. It was marked under review and a re-review request was opened.</p> : null}
            {decision.sideEffects.alertSecOps ? <p className="text-sm">Security Operations has been notified.</p> : null}
          </div>
        ) : !error ? (
          <p className="text-sm text-muted-foreground">The decision will appear here.</p>
        ) : null}
        {decision && canRequest(decision) ? <RequestForm serviceId={serviceId} requestedClass={decision.effectiveClass as 1 | 2 | 3} /> : null}
      </section>
    </div>
  );
}

// Offered when the tool isn't cleared for this data: R5 (over the ceiling) and R7 (not reviewed yet).
function canRequest(d: Decision) {
  return (d.rule === "R5" || d.rule === "R7") && d.effectiveClass !== null && d.effectiveClass <= 3;
}

function RequestForm({ serviceId, requestedClass }: { serviceId: string; requestedClass: 1 | 2 | 3 }) {
  const file = useServerFn(fileRequestFn);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await file({ data: { serviceId, requestedClass, reason } });
      setDone(`Request ${r.id} filed for ${r.serviceName}. It goes to the ${r.route} approval route. Track it on the Approvals page.`);
      setReason("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not file the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Need this tool for {CLASS_NAMES[requestedClass]} data? Ask for approval.</h2>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} maxLength={500} rows={2}
        placeholder="Why do you need it?" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {busy ? "Sending…" : "Request access"}
      </button>
      {done ? <p className="text-sm text-green-800">{done}</p> : null}
      {err ? <p role="alert" className="text-sm text-destructive">{err}</p> : null}
    </form>
  );
}
