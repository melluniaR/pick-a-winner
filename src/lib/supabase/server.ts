import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof cookieStore.getAll === "function") {
            return cookieStore.getAll();
          }
          return [];
        },
        setAll() {
          // Server Components cannot mutate cookies; no-op to avoid runtime errors.
        },
      },
    }
  );
}
