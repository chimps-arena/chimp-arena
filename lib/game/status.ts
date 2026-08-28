import { supabaseAdmin } from "@/lib/supabase/server";
import { dailyMissions, utcDay, MISSION_RULES } from "@/lib/game/config";
import type { MeResponse } from "@/lib/types";

/** Build the "today" block of the /me response for a wallet. */
export async function todayStatus(wallet: string): Promise<MeResponse["today"]> {
  const date = utcDay();
  const missions = dailyMissions(date);

  const { data: runs } = await supabaseAdmin()
    .from("mission_runs")
    .select("mission_slug, score, xp_awarded")
    .eq("wallet", wallet)
    .eq("day", date);

  const byslug = new Map<string, { score: number; xp: number }>();
  for (const r of runs ?? []) {
    byslug.set(r.mission_slug, {
      score: r.score as number,
      xp: r.xp_awarded as number,
    });
  }

  let xpEarnedToday = 0;
  const list = missions.map((def) => {
    const run = byslug.get(def.slug);
    if (run) xpEarnedToday += run.xp;
    return {
      def,
      completed: Boolean(run),
      bestScore: run ? run.score : null,
      xpEarned: run ? run.xp : 0,
      higherIsBetter: MISSION_RULES[def.slug]?.higherIsBetter ?? true,
    };
  });

  return { date, missions: list, xpEarnedToday };
}
