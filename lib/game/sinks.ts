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
export function resaleMemo(kind: "property" | "nft", id: string): string {
  return `ASTROFEE:${kind}:${id}`;
}
