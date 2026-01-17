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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [displayCode, setDisplayCode] = useState("");
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [displayLoading, setDisplayLoading] = useState(false);

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

  const handleDisplay = async (event: React.FormEvent) => {
    event.preventDefault();
    setDisplayError(null);
    const code = displayCode.trim();
    if (!code) {
      setDisplayError(t("join_code_required"));
      return;
    }

    setDisplayLoading(true);
    try {
      const res = await fetch(`/api/display/by-code?code=${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setDisplayError(t("display_code_invalid"));
        setDisplayLoading(false);
        return;
      }
      const data = (await res.json()) as { token?: string };
      if (!data.token) {
        setDisplayError(t("display_code_invalid"));
        setDisplayLoading(false);
        return;
      }
      router.push(`/display/${data.token}`);
    } catch {
      setDisplayError(t("display_code_invalid"));
    } finally {
      setDisplayLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted">
              {t("camp_prediction_game")}
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
              {t("sessions_persist")}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-muted">
                {t("email")}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none ring-0 transition focus:border-accent"
                />
              </label>
              <label className="block text-sm font-medium text-muted">
                {t("password")}
                <div className="relative mt-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 pr-12 text-base text-foreground outline-none ring-0 transition focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    aria-label={showPassword ? t("hide_password") : t("show_password")}
                    title={showPassword ? t("hide_password") : t("show_password")}
                  >
                    {showPassword ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6 0 9.6 5.4 9.6 7 0 .6-.5 1.6-1.4 2.7" />
                        <path d="M6.3 6.3C3.8 8.1 2.4 10.7 2.4 12c0 1.6 3.6 7 9.6 7a10 10 0 0 0 3.6-.7" />
                      </svg>
                    ) : (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2.4 12c0-1.6 3.6-7 9.6-7s9.6 5.4 9.6 7-3.6 7-9.6 7-9.6-5.4-9.6-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
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
                {loading ? t("loading") : mode === "sign_in" ? t("sign_in") : t("sign_up")}
              </button>
            </form>

            <div className="mt-6 border-t border-border/60 pt-6">
              <h3 className="text-lg font-semibold text-foreground">
                {t("view_display")}
              </h3>
              <p className="mt-2 text-sm text-muted">
                {t("view_display_description")}
              </p>
              <form onSubmit={handleDisplay} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={displayCode}
                  onChange={(event) => setDisplayCode(event.target.value)}
                  placeholder={t("enter_game_code")}
                  className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={displayLoading}
                  className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {displayLoading ? t("loading") : t("view_display")}
                </button>
              </form>
              {displayError && (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {displayError}
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col justify-between rounded-3xl border border-border bg-card p-8">
            <div>
              <h3 className="text-2xl font-semibold text-foreground">
                {t("live_camp_rounds")}
              </h3>
              <p className="mt-3 text-sm text-muted">
                {t("live_camp_description")}
              </p>
              <div className="mt-6 grid gap-3 text-sm text-muted">
                <div className="rounded-2xl border border-border bg-card-strong px-4 py-3">
                  {t("stat_players")}
                </div>
                <div className="rounded-2xl border border-border bg-card-strong px-4 py-3">
                  {t("stat_rolling_rounds")}
                </div>
                <div className="rounded-2xl border border-border bg-card-strong px-4 py-3">
                  {t("stat_display_token")}
                </div>
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              {t("powered_by_realtime")}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
