import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePersona } from "@/lib/persona";

// Wraps every signed-in page: redirects to /login until a demo persona is chosen.
export function AppShell({ children }: { children: (persona: NonNullable<ReturnType<typeof usePersona>["persona"]>) => ReactNode }) {
  const { loading, signedIn, persona } = usePersona();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!signedIn || !persona)) void navigate({ to: "/login" });
  }, [loading, signedIn, persona, navigate]);

  if (loading || !persona) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold">ShadowQ</span>
            <nav className="flex flex-wrap gap-4 text-sm">
              <Link to="/simulator" className="text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground">
                Simulator
              </Link>
              <Link to="/registry" className="text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground">
                Registry
              </Link>
              <Link to="/discovery" className="text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground">
                Discovery
              </Link>
              <Link to="/approvals" className="text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground">
                Approvals
              </Link>
              <Link to="/audit" className="text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground">
                Audit log
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span>
              {persona.display_name} <span className="text-muted-foreground">· {persona.id}</span>
            </span>
            <button
              className="rounded-md border border-input px-3 py-1 hover:bg-accent"
              onClick={async () => {
                await supabase.auth.signOut();
                void navigate({ to: "/login" });
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children(persona)}</main>
    </div>
  );
}
