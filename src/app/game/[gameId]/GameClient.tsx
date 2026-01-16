"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/SupabaseProvider";
import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Alias = {
  id: string;
  name: string;
  is_active: boolean;
};

type LeaderRow = {
  alias_id: string;
  points: number;
  correct_count: number;
  alias_name: string | null;
  owner_name: string | null;
};

type ActiveRound = {
  round_id: string;
  game_id: string;
  title: string | null;
  hint_text: string | null;
  status: "OPEN";
  opened_at: string | null;
  options: { id: string; label: string }[];
};

export default function GameClient({ gameId }: { gameId: string }) {
  const supabase = useSupabase();
  const session = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [gameName, setGameName] = useState<string | null>(null);
  const [role, setRole] = useState<"HOST" | "PLAYER" | null>(null);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [selectedAliasId, setSelectedAliasId] = useState<string | null>(null);
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [votesMap, setVotesMap] = useState<Record<string, string>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newAliasName, setNewAliasName] = useState("");

  const activeOptions = useMemo(() => activeRound?.options ?? [], [activeRound]);

  useEffect(() => {
    if (!session) return;

    const loadBase = async () => {
      const { data: membership } = await supabase
        .from("game_memberships")
        .select("role, games ( name )")
        .eq("game_id", gameId)
        .maybeSingle();

      const membershipGame = Array.isArray(membership?.games)
        ? membership?.games[0]
        : membership?.games;

      setRole(membership?.role ?? null);
      setGameName(membershipGame?.name ?? null);
    };

    loadBase();
  }, [session, gameId, supabase]);

  const fetchAliases = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("aliases")
      .select("id, name, is_active")
      .eq("game_id", gameId)
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    const list = (data as Alias[]) ?? [];
    setAliases(list);
    setSelectedAliasId((prev) => prev ?? list[0]?.id ?? null);
  }, [gameId, session, supabase]);

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from("alias_scores")
      .select("alias_id, points, correct_count, aliases ( name, user_id )")
      .eq("game_id", gameId)
      .order("points", { ascending: false })
      .order("aliases(name)", { ascending: true });

    type AliasRef = { name: string | null; user_id: string | null };
    const getAlias = (aliases: AliasRef | AliasRef[] | null) =>
      Array.isArray(aliases) ? aliases[0] ?? null : aliases;

    const rows = (data ?? []).map((row) => {
      const alias = getAlias(row.aliases);
      return {
        alias_id: row.alias_id,
        points: row.points ?? 0,
        correct_count: row.correct_count ?? 0,
        alias_name: alias?.name ?? null,
        owner_id: alias?.user_id ?? null,
      };
    });

    const ownerIds = rows
      .map((row) => row.owner_id)
      .filter((id): id is string => Boolean(id));

    let ownerMap: Record<string, string> = {};
    if (ownerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ownerIds);

      ownerMap = (profiles ?? []).reduce((acc, profile) => {
        acc[profile.user_id] = profile.display_name;
        return acc;
      }, {} as Record<string, string>);
    }

    const normalized = rows.map((row) => ({
      alias_id: row.alias_id,
      points: row.points,
      correct_count: row.correct_count,
      alias_name: row.alias_name,
      owner_name: row.owner_id ? ownerMap[row.owner_id] ?? null : null,
    }));

    setLeaderboard(normalized);
  }, [gameId, supabase]);

  const fetchVotesForRound = useCallback(
    async (roundId: string) => {
      if (!session) return;
      const { data } = await supabase
      .from("votes")
      .select("alias_id, option_id")
      .eq("round_id", roundId);

      const nextMap: Record<string, string> = {};
      (data ?? []).forEach((vote) => {
        nextMap[vote.alias_id] = vote.option_id;
      });
      setVotesMap(nextMap);
    },
    [session, supabase]
  );

  const fetchActiveRound = useCallback(async () => {
    const { data } = await supabase.rpc("active_round_for_game", {
      p_game_id: gameId,
    });

    const round = (data as ActiveRound[] | null)?.[0] ?? null;
    setActiveRound(round);

    if (round) {
      await fetchVotesForRound(round.round_id);
    } else {
      setVotesMap({});
    }
  }, [fetchVotesForRound, gameId, supabase]);

  useEffect(() => {
    if (!session) return;
    fetchAliases();
    fetchLeaderboard();
    fetchActiveRound();
  }, [session, fetchAliases, fetchLeaderboard, fetchActiveRound]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      fetchActiveRound();
    }, 5000);

    return () => clearInterval(interval);
  }, [session, fetchActiveRound]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`scores-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alias_scores", filter: `game_id=eq.${gameId}` },
        () => fetchLeaderboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, gameId, supabase, fetchLeaderboard]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`rounds-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `game_id=eq.${gameId}` },
        () => {
          fetchActiveRound();
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, gameId, supabase, fetchActiveRound, fetchLeaderboard]);

  useEffect(() => {
    if (!session || !activeRound) return;
    const channel = supabase
      .channel(`votes-${activeRound.round_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `round_id=eq.${activeRound.round_id}` },
        () => fetchVotesForRound(activeRound.round_id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, activeRound, supabase, fetchVotesForRound]);

  const toggleAlias = (aliasId: string) => {
    setSelectedAliasId((prev) => (prev === aliasId ? null : aliasId));
  };

  const handleVote = async (optionId: string) => {
    if (!session || !activeRound) return;
    if (!selectedAliasId) {
      setStatusMessage(t("select_alias_first"));
      return;
    }

    const { error } = await supabase.from("votes").upsert(
      {
        round_id: activeRound.round_id,
        alias_id: selectedAliasId,
        option_id: optionId,
        user_id: session.user.id,
      },
      { onConflict: "round_id,alias_id" }
    );

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setVotesMap((prev) => ({ ...prev, [selectedAliasId]: optionId }));

    setStatusMessage(t("vote_applied"));
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const handleCreateAlias = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !newAliasName.trim()) return;

    const { error } = await supabase.from("aliases").insert({
      game_id: gameId,
      user_id: session.user.id,
      name: newAliasName.trim(),
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setNewAliasName("");
    fetchAliases();
  };

  useEffect(() => {
    if (session === null) {
      router.push("/login");
    }
  }, [session, router]);

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted">
              {t("game_label")}
            </p>
            <h1 className="text-4xl font-semibold text-foreground">
              {gameName ?? t("loading")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {role === "HOST" && (
              <Link
                href={`/game/${gameId}/host`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-accent"
              >
                {t("host_controls")}
              </Link>
            )}
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => router.push("/games")}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              {t("all_games")}
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  {t("my_aliases")}
                </h2>
                <span className="text-xs uppercase tracking-[0.2em] text-muted">
                  {t("active_count", { count: aliases.length })}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {aliases.map((alias) => {
                  const selected = selectedAliasId === alias.id;
                  return (
                    <button
                      key={alias.id}
                      type="button"
                      onClick={() => toggleAlias(alias.id)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        selected
                          ? "border-accent bg-accent text-white"
                          : "border-border bg-card text-muted hover:text-foreground"
                      }`}
                    >
                      {alias.name}
                      {votesMap[alias.id] && activeRound && (
                        <span className="ml-2 text-xs opacity-80">
                          {t("alias_voted")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={handleCreateAlias}
                className="mt-4 flex flex-wrap gap-2"
              >
                <input
                  value={newAliasName}
                  onChange={(event) => setNewAliasName(event.target.value)}
                  placeholder={t("alias_name")}
                  className="flex-1 rounded-2xl border border-border bg-card px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
                >
                  {t("create_alias")}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-border bg-card p-6">
              {activeRound ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-foreground">
                      {t("active_round")}
                    </h2>
                    <span className="rounded-full border border-border px-3 py-1 text-xs uppercase text-muted">
                      {t("status_open")}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {activeRound.title ?? t("round_fallback")}
                  </p>
                  {activeRound.hint_text && (
                    <p className="mt-2 text-sm text-muted">
                      <span className="font-semibold text-foreground">
                        {t("hint")}: 
                      </span>
                      {activeRound.hint_text}
                    </p>
                  )}

                  <div className="mt-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-muted">
                      {t("choose_option")}
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {activeOptions.map((option) => {
                    const isSelected =
                      selectedAliasId &&
                      votesMap[selectedAliasId] === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleVote(option.id)}
                        className={`rounded-2xl border px-4 py-4 text-left text-base font-semibold transition ${
                          isSelected
                            ? "border-accent bg-card-strong text-foreground"
                            : "border-border bg-card text-foreground hover:border-accent hover:bg-card-strong"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                    </div>
                  </div>

                  {statusMessage && (
                    <p className="mt-4 text-sm text-muted">{statusMessage}</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    {t("waiting_round")}
                  </h2>
                  <p className="text-sm text-muted">
                    {t("waiting_round_description")}
                  </p>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {t("leaderboard")}
            </h2>
            <div className="mt-4 space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted">{t("no_scores")}</p>
              ) : (
                leaderboard.map((row, index) => (
                  <div
                    key={row.alias_id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-muted">
                        #{index + 1}
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {row.alias_name ?? t("alias_fallback")}
                        {row.owner_name ? ` (${row.owner_name})` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-foreground">
                        {row.points}
                      </p>
                      <p className="text-xs text-muted">
                        {t("correct_count", { count: row.correct_count })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
