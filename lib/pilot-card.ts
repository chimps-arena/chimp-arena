/**
 * Server-only. What a player's public share card shows (/p/<code> and its
 * image at /api/card/<code>), read straight from our tables. Nothing on the
 * card comes from the share link itself, so nobody can brag with a score
 * they didn't get.
 */
import { supabaseAdmin } from "@/lib/supabase/server";
import { crewBySlug, missionBySlug, utcDay } from "@/lib/game/config";
import { computeRank } from "@/lib/game/ranks";
import { isRefCode } from "@/lib/referral";
import type { Crew } from "@/lib/types";

export interface PilotCard {
  code: string;
  handle: string;
  crew: Crew | null;
  level: number;
  xp: number;
  rankName: string;
  /** Live streak: 0 once a day has been missed. */
  streak: number;
  /** Present when the link names a mission the player has run. */
  mission: { title: string; score: number; day: string; xpAwarded: number } | null;
}

export async function getPilotCard(code: string, missionSlug?: string | null): Promise<PilotCard | null> {
  if (!isRefCode(code)) return null;
  const db = supabaseAdmin();
  const { data: p } = await db
    .from("players")
    .select("wallet, handle, crew_slug, xp, streak_count, last_active_day")
    .eq("ref_code", code)
    .maybeSingle();
  if (!p) return null;

  const def = missionSlug ? missionBySlug(missionSlug) : null;
  const [{ count: propertiesOwned }, runRes] = await Promise.all([
    db.from("properties").select("id", { count: "exact", head: true }).eq("owner_wallet", p.wallet),
    def
      ? db
          .from("mission_runs")
          .select("score, day, xp_awarded")
          .eq("wallet", p.wallet)
          .eq("mission_slug", def.slug)
          .order("day", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const today = utcDay();
  const yesterday = utcDay(new Date(Date.now() - 86_400_000));
  const streakAlive = p.last_active_day === today || p.last_active_day === yesterday;
  const rank = computeRank(p.xp, propertiesOwned ?? 0);
  const run = runRes.data as { score: number; day: string; xp_awarded: number } | null;

  return {
    code,
    handle: p.handle,
    crew: crewBySlug(p.crew_slug),
    level: rank.level,
    xp: p.xp,
    rankName: rank.current.name,
    streak: streakAlive ? (p.streak_count ?? 0) : 0,
    mission: def && run ? { title: def.title, score: run.score, day: run.day, xpAwarded: run.xp_awarded } : null,
  };
}
