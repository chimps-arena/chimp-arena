export type MissionType = "reaction" | "trivia" | "astro-run" | "dodge";

export interface Crew {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string; // hex, used for accents
  blurb: string;
}

export interface MissionDef {
  slug: string;
  title: string;
  type: MissionType;
  blurb: string;
  baseXp: number;
  href: string;
}

export interface PlayerProfile {
  wallet: string;
  handle: string;
  crewSlug: string | null;
  xp: number;
  createdAt: string;
}

export interface MeResponse {
  player: PlayerProfile | null;
  crew: Crew | null;
  today: {
    date: string; // UTC YYYY-MM-DD
    missions: Array<{
      def: MissionDef;
      completed: boolean;
      bestScore: number | null;
      xpEarned: number;
      higherIsBetter: boolean;
    }>;
    xpEarnedToday: number;
  };
  /** Pre-launch $CHIMP projection (read-only; no token on chain yet). */
  week: {
    start: string; // Monday 00:00 UTC, YYYY-MM-DD
    xp: number; // your XP earned this week
    poolXp: number; // total XP earned this week across all players
    projectedChimp: number; // your projected share of the weekly pool
  };
}

export interface LeaderboardPlayer {
  rank: number;
  wallet: string;
  handle: string;
  crewSlug: string | null;
  xp: number;
}

export interface LeaderboardCrew {
  rank: number;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  totalXp: number;
  members: number;
}

export interface LeaderboardResponse {
  players: LeaderboardPlayer[];
  crews: LeaderboardCrew[];
  updatedAt: string;
}

/** Payload embedded in a signed mission "start" token. */
export interface StartTokenClaims {
  wallet: string;
  slug: string;
  /** mission start time, unix seconds (distinct from the JWT's own `iat`) */
  sat: number;
  /** mission-specific server-side secret data (e.g. trivia answer key) */
  data?: Record<string, unknown>;
}

export interface SubmitResult {
  ok: true;
  xpAwarded: number;
  totalXp: number;
  alreadyClaimedToday: boolean;
  scoreAccepted: number;
}
