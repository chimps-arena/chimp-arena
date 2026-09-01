import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CREWS } from "@/lib/game/config";
import type {
  LeaderboardResponse,
  LeaderboardPlayer,
  LeaderboardCrew,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_N = 100;

export async function GET() {
  const db = supabaseAdmin();

  const { data: players } = await db
    .from("players")
    .select("wallet, handle, crew_slug, xp, streak_count")
    .order("xp", { ascending: false })
    .limit(TOP_N);

  const playerRows: LeaderboardPlayer[] = (players ?? []).map((p, i) => ({
    rank: i + 1,
    wallet: p.wallet,
    handle: p.handle,
    crewSlug: p.crew_slug,
    xp: p.xp,
    streak: p.streak_count ?? 0,
  }));

  // Crew totals across ALL members (not just the top 100).
  const { data: crewAgg } = await db
    .from("players")
    .select("crew_slug, xp")
    .not("crew_slug", "is", null);

  const totals = new Map<string, { xp: number; members: number }>();
  for (const row of crewAgg ?? []) {
    const t = totals.get(row.crew_slug) ?? { xp: 0, members: 0 };
    t.xp += row.xp ?? 0;
    t.members += 1;
    totals.set(row.crew_slug, t);
  }

  const crewRows: LeaderboardCrew[] = CREWS.map((c) => {
    const t = totals.get(c.slug) ?? { xp: 0, members: 0 };
    return {
      rank: 0,
      slug: c.slug,
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      totalXp: t.xp,
      members: t.members,
    };
  })
    .sort((a, b) => b.totalXp - a.totalXp)
    .map((c, i) => ({ ...c, rank: i + 1 }));

  const payload: LeaderboardResponse = {
    players: playerRows,
    crews: crewRows,
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(payload);
}
