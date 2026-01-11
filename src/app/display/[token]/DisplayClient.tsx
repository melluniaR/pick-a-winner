"use client";

import { useEffect, useState } from "react";

type DisplayState = {
  game: { id: string; name: string };
  mode: "OPEN" | "LEADERBOARD";
  round?: { id: string; title: string | null; hint_text: string | null };
  options?: { id: string; label: string; count: number }[];
  totalVotes?: number;
  leaderboard: { alias_id: string; name: string; points: number }[];
};

export default function DisplayClient({ token }: { token: string }) {
  const [state, setState] = useState<DisplayState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchState = async () => {
      try {
        const res = await fetch(`/api/display/${token}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Unable to load display state.");
        }
        const data = (await res.json()) as DisplayState;
        if (active) setState(data);
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg text-muted">
        {error}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg text-muted">
        Loading display...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-10 py-12 text-foreground">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted">
              Live display
            </p>
            <h1 className="text-5xl font-semibold tracking-tight">
              {state.game.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = "/games";
                }
              }}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Exit display
            </button>
            <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted">
              {state.mode === "OPEN" ? "Voting live" : "Leaderboard"}
            </div>
          </div>
        </header>

        {state.mode === "OPEN" && state.round ? (
          <section className="rounded-[2rem] border border-border bg-card p-10 shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted">
                  Active round
                </p>
                <h2 className="text-4xl font-semibold">
                  {state.round.title ?? "Round"}
                </h2>
              </div>
              <p className="text-sm text-muted">
                Total votes: {state.totalVotes ?? 0}
              </p>
            </div>
            {state.round.hint_text && (
              <p className="mt-3 text-lg text-muted">
                {state.round.hint_text}
              </p>
            )}

            <div className="mt-8 grid gap-4">
              {(state.options ?? []).map((option) => {
                const percentage = state.totalVotes
                  ? Math.round((option.count / state.totalVotes) * 100)
                  : 0;
                return (
                  <div
                    key={option.id}
                    className="rounded-2xl border border-border bg-card px-6 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold">{option.label}</p>
                      <p className="text-sm text-muted">
                        {option.count} votes ({percentage}%)
                      </p>
                    </div>
                    <div className="mt-3 h-3 w-full rounded-full bg-card-strong">
                      <div
                        className="h-3 rounded-full bg-accent"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-border bg-card p-10 shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted">
                  Standings
                </p>
                <h2 className="text-4xl font-semibold">Leaderboard</h2>
              </div>
              <p className="text-sm text-muted">Top {state.leaderboard.length}</p>
            </div>
            <div className="mt-8 grid gap-4">
              {state.leaderboard.map((row, index) => (
                <div
                  key={row.alias_id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-semibold text-muted">
                      #{index + 1}
                    </span>
                    <span className="text-2xl font-semibold">{row.name}</span>
                  </div>
                  <span className="text-3xl font-semibold text-foreground">
                    {row.points}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
