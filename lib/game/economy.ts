/**
 * $CHIMP economy constants.
 *
 * v1 model (TOKEN-POLICY.md): CHIMP is a SPEND-ONLY utility currency. Players
 * acquire it by swapping SOL/USDC -> CHIMP and spend it on Chimps / land /
 * items. There is NO play-to-earn in v1.
 *
 * The emission curve, weekly-pool and Merkle-claim helpers below are PARKED
 * for a possible future rewards season - kept, not deleted, and not wired
 * into any production path.
 */
import { PUBLIC_ENV } from "@/lib/env";

export const TOKEN_SYMBOL = PUBLIC_ENV.tokenSymbol; // "CHIMP"

export const CHIMP_DECIMALS = 6;

/* ----------------------------- tokenomics ---------------------------- */

export const TOKEN_MAX_SUPPLY = 1_000_000_000;

/** Fractions of max supply (founder plan, 2026-09-01 - TOKEN-POLICY.md).
 *  `ecosystemRewards` is PARKED pending a founder decision. Sums to 1.0. */
export const ALLOCATION = {
  founders: 0.2, // 12-mo cliff, 36-mo linear vest
  treasury: 0.25, // ops + progressive protocol-owned liquidity
  ecosystemRewards: 0.2, // PARKED - no play-to-earn in v1
  community: 0.15, // + partnerships; scheduled distribution
  liquidity: 0.1, // initial seed; LP locked, POL
  corpReserve: 0.1, // legal, development, marketing, infrastructure
} as const;

/** Liquidity policy: treasury tops up the pool toward this share of
 *  circulating supply (TOKEN-POLICY.md guardrail 3). */
export const TARGET_POOL_DEPTH_OF_CIRCULATING = 0.15;

/* ------------------------- PARKED: rewards season ------------------- */
/* Everything from here to "daily streaks" is inert in v1. Do not import
 * into a production route without a TOKEN-POLICY.md sign-off. */

/** Per-Chimp land holdings ceiling. */
export const LAND_CAP_PER_CHIMP = 5;
export const ASTEROID_SLOT_CAP_PER_CHIMP = 2;

/** Crew join gate: at least this XP, or a vouch from a member above
 *  CREW_VOUCH_MIN_XP. */
export const CREW_JOIN_MIN_XP = 100;
export const CREW_VOUCH_MIN_XP = 500;

/* ------------------------------- daily streaks ----------------------- */

/** Bonus XP rate from a streak: +3% per day, capped at +30% (day 11+).
 *  Applied to the XP of the run that advances the streak that day. */
export const STREAK_BONUS_PER_DAY = 0.03;
export const STREAK_BONUS_CAP = 0.3;

export function streakMultiplier(streakDay: number): number {
  if (streakDay <= 1) return 0;
  return Math.min(STREAK_BONUS_CAP, (streakDay - 1) * STREAK_BONUS_PER_DAY);
}

/** Flat one-off XP when a streak reaches a milestone day. */
export const STREAK_MILESTONES: Record<number, number> = {
  3: 50,
  7: 150,
  14: 400,
  30: 1200,
};

/** The next milestone day at or after the current streak, or null past the top. */
export function nextStreakMilestone(streakDay: number): number | null {
  const days = Object.keys(STREAK_MILESTONES)
    .map(Number)
    .sort((a, b) => a - b);
  return days.find((d) => d > streakDay) ?? null;
}

/** Whole CHIMP -> base units (bigint). */
export function toBaseUnits(whole: number): bigint {
  return BigInt(Math.round(whole * 10 ** CHIMP_DECIMALS));
}

/** Base units -> whole CHIMP (number; for display only). */
export function toWhole(base: bigint): number {
  return Number(base) / 10 ** CHIMP_DECIMALS;
}

/* --------------------------- Season 1 emission --------------------------- */

/**
 * First Monday of Season 1 (UTC). TODO: confirm at launch — this gates
 * `weekIndexOf` and therefore every pool size.
 */
export const SEASON_1_START = "2026-09-01";

/** 1-based Season 1 week index for a Monday `YYYY-MM-DD`. */
export function weekIndexOf(weekStart: string): number {
  const a = Date.parse(`${SEASON_1_START}T00:00:00Z`);
  const b = Date.parse(`${weekStart}T00:00:00Z`);
  return Math.floor((b - a) / (7 * 86_400_000)) + 1;
}

/**
 * Weekly pool in whole CHIMP by Season 1 week index (ECONOMY.md §13).
 * Geometric taper; sums to the 150M play-to-earn budget over 52 weeks.
 * Weeks < 1 are clamped to week 1 so the pre-launch projection is meaningful;
 * after week 52 the season is over (0).
 */
export function weeklyPool(weekIndex: number): number {
  const w = weekIndex < 1 ? 1 : weekIndex;
  if (w <= 13) return 5_300_000;
  if (w <= 26) return 3_180_000;
  if (w <= 39) return 1_900_000;
  if (w <= 52) return 1_150_000;
  return 0;
}

/** Per-wallet ceiling: no wallet may take more than this fraction of a pool (§21). */
export const PER_WALLET_CAP_FRACTION = 0.03;

/* ----------------------------- week helpers ---------------------------- */

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

/** The Monday before `weekStart` — i.e. the most recently completed week. */
export function previousWeekStart(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------ reward math --------------------------- */

/**
 * One wallet's CHIMP for a week: pro-rata by XP, floored, then capped at
 * `PER_WALLET_CAP_FRACTION` of the pool. Amounts capped away are simply not
 * emitted (they roll back to the treasury via the unclaimed clawback).
 */
export function allocationFor(
  myXp: number,
  totalXp: number,
  poolBaseUnits: bigint,
): bigint {
  if (myXp <= 0 || totalXp <= 0) return 0n;
  const raw = (poolBaseUnits * BigInt(myXp)) / BigInt(totalXp);
  const cap =
    (poolBaseUnits * BigInt(Math.round(PER_WALLET_CAP_FRACTION * 1e6))) /
    1_000_000n;
  return raw < cap ? raw : cap;
}

/**
 * Pre-freeze projection for the "This week" UI: your share of the current
 * week's pool at today's XP split, in whole CHIMP.
 */
export function projectedWeeklyChimp(
  myWeekXp: number,
  poolXp: number,
  weekStart: string = currentWeekStart(),
): number {
  if (poolXp <= 0 || myWeekXp <= 0) return 0;
  const pool = weeklyPool(weekIndexOf(weekStart));
  return Math.floor((pool * myWeekXp) / poolXp);
}
