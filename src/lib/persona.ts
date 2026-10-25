import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Persona = {
  id: string;
  display_name: string;
  department_id: string;
  manager_id: string | null;
  roles: string[];
};

type PersonaState = { loading: boolean; signedIn: boolean; persona: Persona | null };

// The seven demo personas claim_persona() accepts.
export const DEMO_PERSONAS = [
  { id: "E-1007", name: "Marco Silva", note: "Support employee — the redirect story" },
  { id: "E-1012", name: "Fatima Khan", note: "Support employee — has the overdue request" },
  { id: "E-1005", name: "Lena Fischer", note: "Support manager — low-route approver" },
  { id: "E-1001", name: "Priya Nair", note: "AI Governance Lead" },
  { id: "E-1002", name: "Daniel Osei", note: "Security approver" },
  { id: "E-1003", name: "Amira Haddad", note: "Privacy Officer" },
  { id: "E-1004", name: "Sam Whitford", note: "SOC analyst — kill switch" },
] as const;

export function usePersona() {
  const [state, setState] = useState<PersonaState>({ loading: true, signedIn: false, persona: null });

  const refresh = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setState({ loading: false, signedIn: false, persona: null });
      return;
    }
    const { data } = await supabase.rpc("my_persona");
    setState({ loading: false, signedIn: true, persona: (data as unknown as Persona | null) ?? null });
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return { ...state, refresh };
}
