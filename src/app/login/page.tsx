"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/SupabaseProvider";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const action =
      mode === "sign_in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error: authError } = await action;

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/games");
  };

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted">
              Camp prediction game
            </p>
            <h1 className="text-4xl font-semibold text-foreground md:text-5xl">
              {t("app_name")}
            </h1>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-border bg-card p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
            <h2 className="text-2xl font-semibold text-foreground">
              {mode === "sign_in" ? t("sign_in") : t("sign_up")}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Signed-in sessions stay active across days on this device.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-muted">
                {t("email")}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-border bg-white/70 px-4 py-3 text-base text-foreground outline-none ring-0 transition focus:border-accent"
                />
              </label>
              <label className="block text-sm font-medium text-muted">
                {t("password")}
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-border bg-white/70 px-4 py-3 text-base text-foreground outline-none ring-0 transition focus:border-accent"
                />
              </label>
              <div className="flex items-center justify-between text-sm text-muted">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  {t("remember_me")}
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setMode((prev) =>
                      prev === "sign_in" ? "sign_up" : "sign_in"
                    )
                  }
                  className="text-accent hover:text-accent-strong"
                >
                  {mode === "sign_in" ? t("sign_up") : t("sign_in")}
                </button>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-accent px-4 py-3 text-base font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "..." : mode === "sign_in" ? t("sign_in") : t("sign_up")}
              </button>
            </form>
          </section>

          <aside className="flex flex-col justify-between rounded-3xl border border-border bg-white/70 p-8">
            <div>
              <h3 className="text-2xl font-semibold text-foreground">
                Live camp rounds
              </h3>
              <p className="mt-3 text-sm text-muted">
                Make fast predictions for multiple aliases, watch the live vote
                distribution, and see the leaderboard update in real time across
                the whole camp.
              </p>
              <div className="mt-6 grid gap-3 text-sm text-muted">
                <div className="rounded-2xl border border-border bg-card-strong px-4 py-3">
                  50-150 players on one scoreboard
                </div>
                <div className="rounded-2xl border border-border bg-card-strong px-4 py-3">
                  Rolling rounds with no visible history
                </div>
                <div className="rounded-2xl border border-border bg-card-strong px-4 py-3">
                  Separate public display token for big screens
                </div>
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Powered by Supabase Realtime
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
