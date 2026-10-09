/**
 * $CHIMP sink parameters — ECONOMY.md §13 (APPROVED 2026-08-30).
 *
 * Amounts are whole CHIMP; convert with `toBaseUnits()` from `economy.ts` at
 * the call site. Nothing here moves real value yet — these feed the mint /
 * land / marketplace flows in ROADMAP.md Groups H–K.
 */

export type ChimpTier = "common" | "rare" | "legendary";

export const CHIMP_MINT = {
  price: { common: 5_000, rare: 25_000, legendary: 100_000 },
  supplyCap: { common: 10_000, rare: 2_000, legendary: 200 },
} as const;

export type ParcelTier = "planet" | "asteroid";

export const LAND = {
  /** planet parcel base price; multiplied by a richness factor in [1, 3] */
  planetParcelBase: 2_000,
  planetRichnessRange: [1, 3] as const,
  /** asteroid claim-slot flat price */
  asteroidSlot: 15_000,
  /** weekly property tax as a fraction of the parcel's purchase price */
  taxRate: { planet: 0.02, asteroid: 0.03 } as const,
  /** weeks after purchase with no tax owed */
  taxGraceWeeks: 4,
  /** a parcel this many weeks delinquent on tax becomes reclaimable */
  reclaimAfterDelinquentWeeks: 6,
} as const;

export type StructureKind = "rig" | "habitat" | "refinery" | "turret";

export const STRUCTURE = {
  placeCost: { rig: 1_000, habitat: 800, refinery: 3_000, turret: 2_500 } as const,
  /** upgrade to level L costs placeCost * upgradeFactor^(L-1) */
  upgradeFactor: 1.8,
} as const;

/** Whole-CHIMP cost to upgrade `kind` to `level` (level 1 = freshly placed). */
export function upgradeCost(kind: StructureKind, level: number): number {
  return Math.round(
    STRUCTURE.placeCost[kind] * STRUCTURE.upgradeFactor ** (level - 1),
  );
}

/** Flat fee, charged only when land yield is bundled into the weekly claim. */
export const CLAIM_FEE = 50;

/**
 * Secondary-trade fee (TOKEN-POLICY.md), on any resale of a property or an
 * Astrochimp NFT. 100% to Astro Corp - founders' decision (2026-09-19), no
 * split with burn/crew. Not built yet (ROADMAP #17 - no secondary market
 * exists), but the rate + destination are locked so the eventual escrow
 * flow just wires these in.
 */
export const MARKETPLACE = {
  feeRate: 0.03,
  split: { astroCorp: 0.03 },
} as const;

/**
 * Tags a resale fee payment so Astro Corp's wallet activity is
 * self-documenting - same convention as ASTRODEED (primary property sale,
 * market-config.ts) and ASTROMINT (NFT mint, mint-config.ts).
 */
export function resaleMemo(kind: "property" | "nft" | "resource", id: string): string {
  return `ASTROFEE:${kind}:${id}`;
}

/**
 * Mining permit fee + tool tiers (Phase 1 "Core Loop" - founder plan,
 * 2026-10-07, revised 2026-10-09 to a pool-priced market - see migration
 * 0026). Tool costs are now resource QUANTITIES, not fixed $CHIMP - the
 * actual $CHIMP cost is computed live from each resource's pool price at
 * purchase time (lib/chain/mint-config.ts has no static tool price anymore
 * for this reason). Gold is the one exception: debited directly from the
 * player's own balance, never priced through the pool (Gold stays
 * non-tradeable). All quantities are placeholders - founder to tune once
 * real pool prices settle into something meaningful.
 */
export const MINING = {
  /** Whole $CHIMP to start one mining run. */
  permitPriceChimp: 10,
  /** Most permits a wallet can *start* per UTC day - paid permits beyond
   *  this roll over to the next day rather than being wasted. */
  dailyPermitCap: 5,
  /** Matches the mission start-token TTL - a reload within this window
   *  resumes the same run instead of losing the permit. */
  resumeWindowSec: 15 * 60,
  /** Resource quantities to reach tool tier 1 or 2 (tier 0, Pickaxe, is
   *  free/default - stays that way; the founder's reference numbers for a
   *  Pickaxe assumed no free starting tool, which doesn't match how this
   *  app already provisions new players, so that one wasn't carried over). */
  tools: {
    1: { gold: 1, cobalt: 3, palladium: 3, crystal: 1 }, // Drill
    2: { gold: 0, cobalt: 6, palladium: 0, crystal: 6 }, // Plasma Cutter
  },
} as const;

/** Tags a mining permit payment - same convention as ASTROMINT/ASTRORENAME. */
export function miningPermitMemo(wallet: string): string {
  return `ASTROPERMIT:${wallet}`;
}

/** Tags a tool-upgrade payment. */
export function toolMemo(wallet: string, tier: number): string {
  return `ASTROTOOL:${wallet}:${tier}`;
}

/**
 * Pool-based resource market (migration 0026) - cobalt/palladium/crystal
 * only, same Gold-stays-off-the-market rule as before. Superseded the
 * player-listing market (0024): that was supply with no real demand since
 * tool purchases just debited a player's own stash. Now tool purchases
 * draw from this same shared pool, which is what actually moves price.
 */
export const RESOURCE_POOL = {
  /** A buy that would ask for more than this fraction of current reserve
   *  in one trade is rejected outright - crude circuit breaker against one
   *  purchase crashing a resource's price (or draining it to nothing). */
  maxTradeFractionOfReserve: 0.2,
} as const;
