export type MissionType = "reaction" | "trivia" | "astro-run" | "dodge";

export interface Property {
  id: string;
  name: string;
  zone: string;
  type: string;
  priceChimp: number;
  ownerWallet: string | null;
  acquiredAt: string | null;
  blurb: string | null;
  /** 'held' = Astro Corp inventory, not released for sale (independent of ownerWallet). */
  status: "listed" | "held";
  /** Resolved server-side; null if no real photo exists yet for this type. */
  image: string | null;
  /** Set by the owner via POST /api/market/list; null if not listed for resale. */
  resalePrice: number | null;
  resaleListedAt: string | null;
}

/**
 * A property in the new NFT-based land system (see app/api/land,
 * app/api/land/claim) - distinct from the legacy off-chain Property above.
 * Ownership lives on-chain once assetAddress is set; nothing here tracks
 * resale, since that happens through wallet/marketplace transfer, not a
 * DB-mediated listing.
 */
export interface LandProperty {
  id: string;
  name: string;
  zone: string;
  type: string;
  priceChimp: number;
  blurb: string | null;
  imageUrl: string | null;
  assetAddress: string | null;
  nonTransferable: boolean;
}

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
  gold: number;
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
  /** Frozen, unclaimed weekly allocations. Base units are strings (bigint). */
  rewards: {
    claimableBaseUnits: string;
    weeks: Array<{ weekStart: string; chimpBaseUnits: string }>;
  };
  streak: {
    count: number; // current consecutive-day streak
    best: number; // longest streak ever
    playedToday: boolean; // a mission completed this UTC day
    atRisk: boolean; // count > 0 and not played today
    nextMilestone: number | null; // next milestone day, or null past the top
  };
  /** Rank ladder (lib/game/ranks.ts) - computed from level + properties owned. */
  rank: {
    name: string;
    index: number;
    unlocks: string;
    next: { name: string; minLevel: number; minProperties: number } | null;
    level: number;
    propertiesOwned: number;
  };
}

export interface LeaderboardPlayer {
  rank: number;
  wallet: string;
  handle: string;
  crewSlug: string | null;
  xp: number;
  streak: number;
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
  /** Present when this run advanced the daily streak. */
  streak?: {
    count: number;
    bonusXp: number; // streak % bonus on this run
    milestoneXp: number; // flat milestone bonus, 0 if none
  };
  goldAwarded: number;
  totalGold?: number;
}
