import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_PERSONAS, usePersona } from "@/lib/persona";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — ShadowQ" }] }),
  component: Login,
});

function Login() {
  const { loading, signedIn, persona, refresh } = usePersona();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/login" } });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === "up" && !data.session) setMessage("Account created. Check your email to confirm it, then sign in.");
    else await refresh();
  }

  async function choose(id: string) {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("claim_persona", { p_employee_id: id });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refresh();
    void navigate({ to: "/simulator" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Northbridge Financial · fictional demo</p>
          <h1 className="mt-1 text-3xl font-semibold">ShadowQ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI governance console. Sign in, then choose which demo employee you want to act as. All people and data are synthetic.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !signedIn ? (
          <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-5">
            <div className="flex gap-4 text-sm">
              <button type="button" className={mode === "in" ? "font-semibold" : "text-muted-foreground"} onClick={() => setMode("in")}>
                Sign in
              </button>
              <button type="button" className={mode === "up" ? "font-semibold" : "text-muted-foreground"} onClick={() => setMode("up")}>
                Create account
              </button>
            </div>
            <label className="block text-sm">
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
            </label>
            <label className="block text-sm">
              Password
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
            </label>
            <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {mode === "in" ? "Sign in" : "Create account"}
            </button>
          </form>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-card p-5">
            <h2 className="font-medium">Act as…</h2>
            {persona ? <p className="text-sm text-muted-foreground">Currently {persona.display_name} ({persona.id}).</p> : null}
            <ul className="space-y-2">
              {DEMO_PERSONAS.map((p) => (
                <li key={p.id}>
                  <button disabled={busy} onClick={() => choose(p.id)}
                    className="w-full rounded-md border border-input px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60">
                    <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">· {p.id}</span>
                    <span className="block text-xs text-muted-foreground">{p.note}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="text-sm text-muted-foreground underline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        )}
        {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
      </div>
    </div>
  );
}
