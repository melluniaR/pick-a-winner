import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, name")
    .eq("display_token", token)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("id, title, hint_text, status")
    .eq("game_id", game.id)
    .eq("status", "OPEN")
    .maybeSingle();

  if (round) {
    const { data: options } = await supabase
      .from("options")
      .select("id, label")
      .eq("round_id", round.id);

    const { data: votes } = await supabase
      .from("votes")
      .select("option_id")
      .eq("round_id", round.id);

    const counts = (options ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      count: (votes ?? []).filter((vote) => vote.option_id === option.id)
        .length,
    }));

    const totalVotes = counts.reduce((acc, item) => acc + item.count, 0);

    return NextResponse.json(
      {
        game,
        mode: "OPEN",
        round,
        options: counts,
        totalVotes,
        leaderboard: [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: leaderboard } = await supabase
    .from("alias_scores")
    .select("alias_id, points, aliases ( name, user_id )")
    .eq("game_id", game.id)
    .order("points", { ascending: false })
    .order("aliases(name)", { ascending: true })
    .limit(12);

  const ownerIds = (leaderboard ?? [])
    .map((row) => row.aliases?.user_id)
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

  const normalized = (leaderboard ?? []).map((row) => ({
    alias_id: row.alias_id,
    alias_name: row.aliases?.name ?? null,
    owner_name:
      row.aliases?.user_id && ownerMap[row.aliases.user_id]
        ? ownerMap[row.aliases.user_id]
        : null,
    points: row.points ?? 0,
  }));

  return NextResponse.json(
    {
      game,
      mode: "LEADERBOARD",
      leaderboard: normalized,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
