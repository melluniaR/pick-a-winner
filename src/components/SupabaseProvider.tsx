"use client";

import { createContext, useContext, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseContextValue = SupabaseClient;

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createClient(), []);
  return (
    <SupabaseContext.Provider value={client}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error("useSupabase must be used within SupabaseProvider");
  return ctx;
}
