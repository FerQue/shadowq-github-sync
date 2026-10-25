import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { usePersona } from "@/lib/persona";

export const Route = createFileRoute("/")({
  component: Index,
});

// The console lives at /simulator; the home route just sends people to sign in or on to the app.
function Index() {
  const { loading, persona } = usePersona();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) void navigate({ to: persona ? "/simulator" : "/login" });
  }, [loading, persona, navigate]);

  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
}
