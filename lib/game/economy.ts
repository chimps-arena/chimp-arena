/**
 * $CHIMP economy constants and pre-launch projections.
 *
 * READ-ONLY / PRE-LAUNCH. No token exists on chain yet (see ROADMAP.md
 * Group G). These values drive the P1 "CHIMP appears" UI only — nothing
 * here moves real value.
 */
import { PUBLIC_ENV } from "@/lib/env";

export const TOKEN_SYMBOL = PUBLIC_ENV.tokenSymbol; // "CHIMP"

/**
 * PROVISIONAL — pending decision #19 (pool size + emission curve).
 * The weekly $CHIMP pool is split pro-rata across all players by XP earned
 * that week. This number is a placeholder for the projection UI.
 */
export const WEEKLY_CHIMP_POOL = 250_000;

/**
 * Monday 00:00 UTC of the week containing `now`, as `YYYY-MM-DD`.
 * Mirrors the SQL `public.utc_week_start()` used by `weekly_xp_live`.
 */
export function currentWeekStart(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

/**
 * Your projected share of this week's pool, floored.
 * Returns 0 until the week has recorded XP.
 */
export function projectedWeeklyChimp(myWeekXp: number, poolXp: number): number {
  if (poolXp <= 0 || myWeekXp <= 0) return 0;
  return Math.floor((WEEKLY_CHIMP_POOL * myWeekXp) / poolXp);
}
