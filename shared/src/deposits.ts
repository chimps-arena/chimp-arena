/**
 * Resource definitions for the mining world - gold, diamond and ruby, per
 * Chalk's early proof assets (A4). Distinct from the existing chimp-arena
 * mining minigame's resources (cobalt/palladium/crystal) - this is a
 * separate world with its own resource set, not a rename.
 *
 * Encodes Austin's F3 decision (2026-10-20): deposits never regenerate.
 * Instead, extraction cost grows exponentially with how much has already
 * been taken from that specific deposit, so it naturally becomes
 * uneconomical to keep mining long before it's fully empty - leaving some
 * amount for try-hards, or for whenever rising demand makes it worth
 * returning to. This is a property of the deposit's own cumulative history,
 * not of the player or their tool.
 */

export type DepositKind = "gold" | "diamond" | "ruby";

export interface DepositDef {
  kind: DepositKind;
  /** Dig cost at zero cumulative extraction. */
  baseHardness: number;
  /** Multiplier applied per unit already extracted - >1 means harder over time. */
  hardnessGrowth: number;
}

export const DEPOSITS: Record<DepositKind, DepositDef> = {
  gold: { kind: "gold", baseHardness: 1, hardnessGrowth: 1.015 },
  diamond: { kind: "diamond", baseHardness: 2.2, hardnessGrowth: 1.025 },
  ruby: { kind: "ruby", baseHardness: 3.5, hardnessGrowth: 1.035 },
};

/** Current dig cost for a deposit, given how much has already been taken from it. */
export function hardnessAt(kind: DepositKind, extractedSoFar: number): number {
  const def = DEPOSITS[kind];
  return def.baseHardness * Math.pow(def.hardnessGrowth, extractedSoFar);
}
