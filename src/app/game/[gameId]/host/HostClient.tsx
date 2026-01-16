"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/SupabaseProvider";
import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/components/I18nProvider";

type RoundRow = {
  id: string;
  title: string | null;
  hint_text: string | null;
  status: "DRAFT" | "OPEN" | "CLOSED" | "SCORED";
  round_number: number;
  opened_at: string | null;
  scored_at: string | null;
};

type OptionCount = {
  option_id: string;
  label: string;
  votes_count: number;
};

type LeaderRow = {
  alias_id: string;
  points: number;
  correct_count: number;
  alias_name: string | null;
  owner_name: string | null;
};

export default function HostClient({ gameId }: { gameId: string }) {
  const supabase = useSupabase();
  const session = useSession();
  const router = useRouter();
  const { t } = useI18n();

  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [gameName, setGameName] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<"ACTIVE" | "ENDED">("ACTIVE");
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [displayToken, setDisplayToken] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<OptionCount[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [title, setTitle] = useState("");
  const [hint, setHint] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedCorrect, setSelectedCorrect] = useState<string | null>(null);

  const openRound = useMemo(
    () => rounds.find((round) => round.status === "OPEN") ?? null,
    [rounds]
  );
  const statusLabel = useCallback(
    (status: RoundRow["status"]) => {
      return t(`status_${status.toLowerCase()}`);
    },
    [t]
  );

  const fetchRounds = useCallback(async () => {
    const { data } = await supabase
      .from("rounds")
      .select("id, title, hint_text, status, round_number, opened_at, scored_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false });

    setRounds((data as RoundRow[]) ?? []);
  }, [gameId, supabase]);

  const fetchGame = useCallback(async () => {
    const { data } = await supabase
      .from("games")
      .select("name, display_token, status, ended_at")
      .eq("id", gameId)
      .maybeSingle();

    setGameName(data?.name ?? null);
    setDisplayToken(data?.display_token ?? null);
    setGameStatus((data?.status as "ACTIVE" | "ENDED") ?? "ACTIVE");
    setEndedAt(data?.ended_at ?? null);
  }, [gameId, supabase]);

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from("alias_scores")
      .select("alias_id, points, correct_count, aliases ( name, user_id )")
      .eq("game_id", gameId)
      .order("points", { ascending: false })
      .order("aliases(name)", { ascending: true });

    const rows = (data ?? []).map((row) => ({
      alias_id: row.alias_id,
      points: row.points ?? 0,
      correct_count: row.correct_count ?? 0,
      alias_name: row.aliases?.name ?? null,
      owner_id: row.aliases?.user_id ?? null,
    }));

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

  const fetchVoteCounts = useCallback(async (roundId: string) => {
    const { data } = await supabase.rpc("option_vote_counts", {
      p_round_id: roundId,
    });

    const normalized = (data as OptionCount[] | null)?.map((item) => ({
      ...item,
      votes_count: Number(item.votes_count),
    }));

    setVoteCounts(normalized ?? []);
  }, [supabase]);

  useEffect(() => {
    if (!session) return;
    fetchGame();
    fetchRounds();
    fetchLeaderboard();
  }, [session, fetchGame, fetchRounds, fetchLeaderboard]);

  useEffect(() => {
    if (openRound?.id) {
      fetchVoteCounts(openRound.id);
      setSelectedCorrect(null);
    } else {
      setVoteCounts([]);
    }
  }, [openRound?.id, fetchVoteCounts]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`host-rounds-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `game_id=eq.${gameId}` },
        () => fetchRounds()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, gameId, supabase, fetchRounds]);

  useEffect(() => {
    if (!session || !openRound?.id) return;
    const channel = supabase
      .channel(`host-votes-${openRound.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `round_id=eq.${openRound.id}` },
        () => fetchVoteCounts(openRound.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, openRound?.id, supabase, fetchVoteCounts]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`host-scores-${gameId}`)
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

  const handleAddOption = () => setOptions((prev) => [...prev, ""]);
  const handleRemoveOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleCreateRound = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatusMessage(null);

    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (trimmedOptions.length < 2) {
      setStatusMessage(t("add_options_error"));
      return;
    }

    const { error } = await supabase.rpc("create_round_with_options", {
      p_game_id: gameId,
      p_title: title || null,
      p_hint_text: hint || null,
      p_options: trimmedOptions,
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setTitle("");
    setHint("");
    setOptions(["", ""]);
    fetchRounds();
  };

  const handleOpenRound = async (roundId: string) => {
    setStatusMessage(null);
    const { error } = await supabase.rpc("open_round", {
      p_round_id: roundId,
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    await fetchRounds();
  };

  const handleScoreRound = async () => {
    if (!openRound || !selectedCorrect) {
      setStatusMessage(t("select_correct_option"));
      return;
    }

    const confirmed = window.confirm(t("confirm_score_round"));
    if (!confirmed) return;

    const { error } = await supabase.rpc("score_round", {
      p_round_id: openRound.id,
      p_correct_option_id: selectedCorrect,
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setSelectedCorrect(null);
    await fetchRounds();
  };

  const handleEndGame = async () => {
    const confirmed = window.confirm(t("confirm_end_game"));
    if (!confirmed) return;

    const { error } = await supabase.rpc("end_game", {
      p_game_id: gameId,
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    await fetchGame();
    await fetchRounds();
    await fetchLeaderboard();
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
              {t("host_controls")}
            </p>
            <h1 className="text-4xl font-semibold text-foreground">
              {gameName ?? t("loading")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {displayToken && (
              <Link
                href={`/display/${displayToken}`}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                {t("display_screen")}
              </Link>
            )}
            {gameStatus === "ACTIVE" ? (
              <button
                type="button"
                onClick={handleEndGame}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-accent"
              >
                {t("end_game")}
              </button>
            ) : (
              <span className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted">
                {t("ended_at", {
                  date: endedAt ? new Date(endedAt).toLocaleString() : "",
                })}
              </span>
            )}
            <button
              type="button"
              onClick={() => router.push(`/game/${gameId}`)}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              {t("player_view")}
            </button>
          </div>
        </header>

        {statusMessage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {statusMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {t("create_round")}
            </h2>
            <form onSubmit={handleCreateRound} className="mt-4 space-y-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("round_title")}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-accent"
              />
              <input
                value={hint}
                onChange={(event) => setHint(event.target.value)}
                placeholder={t("round_hint")}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-accent"
              />

              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={`opt-${index}`} className="flex gap-2">
                    <input
                      value={option}
                      onChange={(event) =>
                        handleOptionChange(index, event.target.value)
                      }
                      placeholder={`${t("round_options")} ${index + 1}`}
                      className="flex-1 rounded-2xl border border-border bg-card px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="rounded-2xl border border-border px-3 text-sm text-muted hover:text-foreground"
                      >
                        {t("remove_option")}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="rounded-2xl border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
                >
                  {t("add_option")}
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
                >
                  {t("save_round")}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {t("leaderboard")}
            </h2>
            <div className="mt-4 space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted">{t("no_scores")}</p>
              ) : (
                leaderboard.map((row) => (
                  <div
                    key={row.alias_id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {row.alias_name ?? t("alias_fallback")}
                      {row.owner_name ? ` (${row.owner_name})` : ""}
                    </p>
                    <p className="text-sm text-muted">
                      {t("points_short", { count: row.points })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {gameStatus === "ENDED" && (
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {t("final_scorecard")}
              </h2>
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                {t("aliases_count", { count: leaderboard.length })}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {leaderboard.map((row, index) => (
                <div
                  key={row.alias_id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <span className="text-sm font-semibold text-muted">
                    #{index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {row.alias_name ?? t("alias_fallback")}
                      {row.owner_name ? ` (${row.owner_name})` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {t("correct_picks", { count: row.correct_count })}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-foreground">
                    {row.points}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              {t("rounds")}
            </h2>
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              {t("total_rounds", { count: rounds.length })}
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {rounds.map((round) => (
              <div
                key={round.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {t("round_number", { number: round.round_number })}
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {round.title ?? t("untitled")}
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                    {statusLabel(round.status)}
                  </span>
                </div>
                {round.hint_text && (
                  <p className="mt-2 text-sm text-muted">{round.hint_text}</p>
                )}
                {round.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={() => handleOpenRound(round.id)}
                    className="mt-4 rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
                  >
                    {t("open_round")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {openRound && (
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {t("live_distribution")}
              </h2>
              <span className="rounded-full border border-border px-3 py-1 text-xs uppercase text-muted">
                {t("status_open")}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {voteCounts.map((option) => (
                <label
                  key={option.option_id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correct-option"
                      checked={selectedCorrect === option.option_id}
                      onChange={() => setSelectedCorrect(option.option_id)}
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                  </div>
                  <span className="text-sm text-muted">
                    {t("votes_label", { count: option.votes_count })}
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted">
                {t("total_votes")}: {voteCounts.reduce((acc, item) => acc + item.votes_count, 0)}
              </p>
              <button
                type="button"
                onClick={handleScoreRound}
                className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                {t("score_round")}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
