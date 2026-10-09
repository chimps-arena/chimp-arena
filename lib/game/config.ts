import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import type { Crew, MissionDef } from "@/lib/types";
import { hash32, mulberry32 } from "@/lib/game/rng";
import { maxDepthFor, TOOLS } from "@/lib/game/mining";

/* ============================ CREWS ============================ */

export const CREWS: Crew[] = [
  {
    id: "crew_banana",
    slug: "banana-bloc",
    name: "Banana Bloc",
    emoji: "🍌",
    color: "#f5c518",
    blurb: "Yellow and relentless. Grind every mission, every day.",
  },
  {
    id: "crew_jungle",
    slug: "jungle-syndicate",
    name: "Jungle Syndicate",
    emoji: "🌴",
    color: "#22c55e",
    blurb: "Deep-canopy operators. Strategy over speed.",
  },
  {
    id: "crew_rocket",
    slug: "rocket-primates",
    name: "Rocket Primates",
    emoji: "🚀",
    color: "#6366f1",
    blurb: "Eyes on orbit. Astro Run is home turf.",
  },
  {
    id: "crew_thunder",
    slug: "thunder-apes",
    name: "Thunder Apes",
    emoji: "⚡",
    color: "#ef4444",
    blurb: "Loud, fast, first. Reaction tests are a formality.",
  },
];

export function crewBySlug(slug: string | null | undefined): Crew | null {
  if (!slug) return null;
  return CREWS.find((c) => c.slug === slug) ?? null;
}

/* ========================== MISSIONS ========================== */

export const MISSION_DEFS: MissionDef[] = [
  {
    slug: "reaction",
    title: "Reflex Check",
    type: "reaction",
    blurb: "Five rounds. Tap the instant the screen flips. Fastest average wins.",
    baseXp: 60,
    href: "/missions/reaction",
  },
  {
    slug: "trivia",
    title: "Jungle Intel",
    type: "trivia",
    blurb: "Five questions on crypto, Solana and $CHIMP lore. Beat the clock.",
    baseXp: 80,
    href: "/missions/trivia",
  },
  {
    slug: "astro-run",
    title: "Astro Run",
    type: "astro-run",
    blurb: "Endless runner. Dodge debris, ride the speed ramp, bank distance.",
    baseXp: 100,
    href: "/missions/astro-run",
  },
  {
    slug: "debris-field",
    title: "Debris Field",
    type: "dodge",
    blurb: "Steer side to side through an asteroid belt. Survive, don't get hit.",
    baseXp: 90,
    href: "/missions/debris-field",
  },
  {
    slug: "mining",
    title: "Deep Core",
    type: "mining",
    blurb: "Buy a permit, dig through the strata. Deeper seams, rarer ore.",
    baseXp: 90,
    href: "/missions/mining",
  },
];

export function missionBySlug(slug: string): MissionDef | null {
  return MISSION_DEFS.find((m) => m.slug === slug) ?? null;
}

/* ===================== DAILY MISSION SET ===================== */

/** UTC date string, e.g. "2026-08-27". Single source of "today". */
export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hash32(seed));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * The MVP runs every defined mission every day (no rotation yet). The
 * helper still exists so the daily set can be narrowed later without
 * touching callers.
 */
export function dailyMissions(day = utcDay()): MissionDef[] {
  void day;
  return MISSION_DEFS;
}

/* ===================== XP + SCORE RULES ===================== */

/**
 * Per-mission scoring. `validate` rejects implausible submissions given the
 * seconds elapsed since the signed start token was issued. `xp` converts an
 * accepted score into an XP award (before the once-per-day gate).
 */
export const MISSION_RULES: Record<
  string,
  {
    validate: (score: number, elapsedSec: number) => boolean;
    xp: (score: number, baseXp: number) => number;
    /** higher raw score is better? (for "best score" display) */
    higherIsBetter: boolean;
  }
> = {
  // score = average reaction time in ms across 5 rounds (lower is better)
  reaction: {
    higherIsBetter: false,
    validate: (score, elapsed) =>
      Number.isFinite(score) &&
      // avg reaction below ~100ms is not humanly possible
      score >= 100 &&
      score <= 2000 &&
      elapsed >= 3 &&
      elapsed <= 600,
    xp: (score, baseXp) => {
      // 500ms avg -> base. Every 25ms faster -> +8 XP, capped at +120.
      const bonus = Math.min(120, Math.max(0, Math.floor((500 - score) / 25) * 8));
      return baseXp + bonus;
    },
  },

  // score = number of correct answers out of 5 (higher is better)
  trivia: {
    higherIsBetter: true,
    validate: (score, elapsed) =>
      Number.isInteger(score) && score >= 0 && score <= 5 && elapsed <= 600,
    xp: (score, baseXp) => Math.round((baseXp * score) / 5) + score * 12,
  },

  // score = distance banked in the runner (higher is better)
  "astro-run": {
    higherIsBetter: true,
    validate: (score, elapsed) =>
      Number.isFinite(score) &&
      score >= 0 &&
      elapsed >= 2 &&
      // a single run can't plausibly last more than 10 minutes
      elapsed <= 600 &&
      // runner advances at most ~55 distance units / second
      score <= elapsed * 55 + 50,
    xp: (score, baseXp) => baseXp + Math.min(400, Math.floor(score / 12)),
  },

  // score = distance survived in the asteroid belt (higher is better)
  "debris-field": {
    higherIsBetter: true,
    validate: (score, elapsed) =>
      Number.isFinite(score) &&
      score >= 0 &&
      elapsed >= 2 &&
      elapsed <= 600 &&
      // the belt scrolls at most ~80 distance units / second
      score <= elapsed * 80 + 50,
    xp: (score, baseXp) => baseXp + Math.min(400, Math.floor(score / 10)),
  },

  // score = depth (meters) reached in the mining shaft (higher is better).
  // This is a loose top-tier ceiling (best tool, TOOLS.length-1) since this
  // function only sees (score, elapsed) - the precise per-tool ceiling is
  // re-checked in the submit route, which has the tool tier from the signed
  // start token.
  mining: {
    higherIsBetter: true,
    validate: (score, elapsed) =>
      Number.isInteger(score) &&
      score >= 0 &&
      elapsed >= 2 &&
      elapsed <= 600 &&
      score <= maxDepthFor(TOOLS.length - 1, elapsed),
    xp: (score, baseXp) => baseXp + Math.min(400, Math.floor(score / 2)),
  },
};

export const DEFAULT_HANDLE = (wallet: string) =>
  `chimp_${wallet.slice(0, 4)}${wallet.slice(-4)}`;

export const HANDLE_RULES = { min: 3, max: 20 } as const;

// Built once per process. Catches common leetspeak/spacing evasions
// ("f_u_c_k", "fuuuck") via obscenity's recommended transformers.
const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/**
 * Validate + normalise a user-supplied handle. Used by the edit UI (instant
 * feedback) and re-checked server-side in PATCH /api/me.
 * Rules: 3-20 chars; letters, digits, `-` and `_` only; no separator at the
 * start or end; no profanity.
 */
export function validateHandle(
  raw: string,
): { ok: true; handle: string } | { ok: false; error: string } {
  const handle = raw.trim();
  if (handle.length < HANDLE_RULES.min || handle.length > HANDLE_RULES.max)
    return {
      ok: false,
      error: `Handle must be ${HANDLE_RULES.min}-${HANDLE_RULES.max} characters.`,
    };
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/.test(handle))
    return {
      ok: false,
      error: "Letters, digits, - and _ only (not at the start or end).",
    };
  if (profanityMatcher.hasMatch(handle))
    return { ok: false, error: "That handle isn't allowed." };
  return { ok: true, handle };
}
