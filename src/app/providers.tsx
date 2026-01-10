"use client";

import { I18nProvider } from "@/components/I18nProvider";
import { SupabaseProvider } from "@/components/SupabaseProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <I18nProvider>{children}</I18nProvider>
    </SupabaseProvider>
  );
}
