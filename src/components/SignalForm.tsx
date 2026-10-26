import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ACTION_TONE, Chip } from "@/components/Chip";
import { ingestSignalFn } from "@/lib/policy/ingest.functions";

type ServiceOption = { id: string; name: string };
type Source = "sso_grant" | "gateway" | "expense" | "endpoint";
type Result = Awaited<ReturnType<typeof ingestSignalFn>>;

export const SOURCE_LABEL: Record<string, string> = {
  gateway: "Web gateway",
  endpoint: "Endpoint agent",
  sso_grant: "SSO grant",
  expense: "Expense report",
  simulator: "Simulator",
};

const PEOPLE = Array.from({ length: 24 }, (_, i) => `E-${1001 + i}`);
const NEW_TOOL = "__new__";

// Demo stand-in for a collector: sends one synthetic signal through the same ingest function production connectors would use.
export function SignalForm({ services, onDone }: { services: ServiceOption[]; onDone: () => void }) {
  const ingest = useServerFn(ingestSignalFn);
  const [source, setSource] = useState<Source>("gateway");
  const [employeeId, setEmployeeId] = useState("E-1011");
  const [tool, setTool] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const chosen = tool || services[0]?.id || "";
  const isNew = chosen === NEW_TOOL;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = isNew ? { source, employeeId, newToolName: newName } : { source, employeeId, serviceId: chosen };
      setResult(await ingest({ data: payload }));
      onDone();
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-lg font-medium">Simulate a signal</h2>
        <p className="text-sm text-muted-foreground">
          Stands in for a real collector (identity provider, web gateway, endpoint agent, expense feed). Send the same person and tool from two sources within 15 minutes and they merge into one usage event. Name a tool that isn't in the registry and it is added as Unknown on first detection.
        </p>
      </div>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">
          Signal source
          <select value={source} onChange={(e) => setSource(e.target.value as Source)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2">
            {(["gateway", "sso_grant", "endpoint", "expense"] as Source[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Person
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2">
            {PEOPLE.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Tool
          <select value={chosen} onChange={(e) => setTool(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2">
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value={NEW_TOOL}>A tool not in the registry…</option>
          </select>
        </label>
        {isNew ? (
          <label className="text-sm">
            New tool name
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required minLength={2} maxLength={60} placeholder="e.g. PromptPilot"
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2" />
          </label>
        ) : <div />}
        <div className="sm:col-span-4">
          <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "Sending…" : "Send signal"}
          </button>
        </div>
      </form>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div className="space-y-1 rounded-md border border-border bg-muted p-3 text-sm" aria-live="polite">
          {result.created ? <p><strong>New tool detected:</strong> {result.serviceName} was added to the registry as Unknown (high risk until reviewed).</p> : null}
          {result.outcome === "merged" ? (
            <p><strong>Duplicate merged.</strong> This matches a usage event from {result.minutesAgo} minute(s) ago, so no new event was created. It is now seen by: {result.sources.map((s) => SOURCE_LABEL[s] ?? s).join(" + ")}.</p>
          ) : (
            <p>
              <strong>New usage event recorded</strong> for {result.serviceName}. Policy decision:{" "}
              {result.decision ? <><Chip tone={ACTION_TONE[result.decision.action]}>{result.decision.action.replace(/_/g, " ")}</Chip> <span className="text-muted-foreground">rule {result.decision.rule}</span> — {result.decision.message}</> : "none"}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
