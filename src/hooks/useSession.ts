"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useSupabase } from "@/components/SupabaseProvider";

export function useSession() {
  const supabase = useSupabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  return session;
}
