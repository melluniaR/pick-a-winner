"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/SupabaseProvider";
import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type GameRow = {
  game_id: string;
  role: "HOST" | "PLAYER";
  games: {
    id: string;
    name: string;
    join_code: string;
    status: "ACTIVE" | "ENDED";
  } | null;
};

export default function GamesPage() {
  const supabase = useSupabase();
  const session = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [gameName, setGameName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [hasDisplayName, setHasDisplayName] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const formatRole = (role: GameRow["role"]) =>
    role === "HOST" ? t("role_host") : t("role_player");
  const formatStatus = (status?: GameRow["games"] | null) => {
    if (!status?.status) return "";
    return t(`status_${status.status.toLowerCase()}`);
  };

  const fetchGames = useCallback(async () => {
    if (!session) return;
    setLoading(true);

    const { data, error: fetchError } = await supabase
      .from("game_memberships")
      .select("game_id, role, games ( id, name, join_code, status )")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setGames((data as GameRow[]) ?? []);
    }
    setLoading(false);
  }, [session, supabase]);

  const fetchProfile = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (data?.display_name) {
      setDisplayName(data.display_name);
      setHasDisplayName(true);
    } else {
      setHasDisplayName(false);
    }
  }, [session, supabase]);

  useEffect(() => {
    fetchGames();
    fetchProfile();
  }, [fetchGames, fetchProfile]);

  useEffect(() => {
    if (session === null) {
      router.push("/login");
    }
  }, [session, router]);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!hasDisplayName) {
      setError(t("display_name_needed_join"));
      return;
    }

    const { data, error: joinError } = await supabase.rpc(
      "join_game_by_code",
      {
        p_join_code: joinCode,
      }
    );

    if (joinError) {
      setError(joinError.message);
      return;
    }

    setJoinCode("");
    router.push(`/game/${data}`);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!hasDisplayName) {
      setError(t("display_name_needed_create"));
      return;
    }

    const { data, error: createError } = await supabase.rpc("create_game", {
      p_name: gameName,
    });

    if (createError) {
      setError(createError.message);
      return;
    }

    setGameName("");
    router.push(`/game/${data}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSaveDisplayName = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError(t("display_name_required"));
      return;
    }

    setSavingDisplayName(true);
    const { error: saveError } = await supabase.rpc("set_display_name", {
      p_display_name: displayName.trim(),
    });

    if (saveError) {
      setError(saveError.message);
      setSavingDisplayName(false);
      return;
    }

    setHasDisplayName(true);
    setSavingDisplayName(false);
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen p-8 text-center text-muted">
        {t("loading")}
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="min-h-screen p-8 text-center text-muted">
        {t("redirecting")}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted">
              {t("my_games")}
            </p>
            <h1 className="text-4xl font-semibold text-foreground">
              {t("app_name")}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
              type="button"
              onClick={handleSignOut}
            >
              {t("sign_out")}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!hasDisplayName && (
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {t("set_display_name")}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {t("display_name_description")}
            </p>
            <form onSubmit={handleSaveDisplayName} className="mt-4 flex gap-3">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t("display_name")}
                className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={savingDisplayName}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingDisplayName ? t("saving") : t("save")}
              </button>
            </form>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {t("join_game")}
            </h2>
            <form onSubmit={handleJoin} className="mt-4 flex flex-col gap-3">
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder={t("enter_game_code")}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                {t("join_game")}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {t("create_game")}
            </h2>
            <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3">
              <input
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
                placeholder={t("game_name")}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                {t("create_game")}
              </button>
            </form>
          </section>
        </div>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("my_games")}
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-muted">{t("loading_games")}</p>
          ) : games.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              {t("no_games")}
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {games.map((membership) => (
                <div
                  key={membership.game_id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {membership.games?.name ?? t("untitled")}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">
                        {formatRole(membership.role)}
                      </p>
                    </div>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                      {formatStatus(membership.games)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {t("join_code_label")}: {membership.games?.join_code}
                  </p>
                  <button
                    className="mt-4 w-full rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
                    type="button"
                    onClick={() => router.push(`/game/${membership.game_id}`)}
                  >
                    {t("enter_game")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
