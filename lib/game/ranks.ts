/**
 * Rank ladder (ECONOMY plan §5 / the game plan artifact).
 *
 * Rank isn't stored - it's computed from level (XP) + properties owned, so
 * the thresholds can be retuned without a migration. "Cluster" / "sector"
 * concepts from the design doc are simplified to a flat property count until
 * the Map Room groups properties into real clusters.
 */
import { levelFromXp } from "@/lib/game/xp";

export interface Rank {
  index: number;
  name: string;
  minLevel: number;
  minProperties: number;
  unlocks: string;
}

export const RANKS: Rank[] = [
  { index: 1, name: "Cadet", minLevel: 1, minProperties: 0, unlocks: "Starter sector, 4 base missions, 1 claim slot" },
  { index: 2, name: "Prospector", minLevel: 5, minProperties: 1, unlocks: "+5% Gold, your name shows on the map" },
  { index: 3, name: "Claim Boss", minLevel: 12, minProperties: 3, unlocks: "+12% Gold" },
  { index: 4, name: "Warden", minLevel: 22, minProperties: 6, unlocks: "+25% Gold, can fortify a claim" },
  { index: 5, name: "Marshal", minLevel: 35, minProperties: 10, unlocks: "+40% Gold, weekly Marshal's cut" },
  { index: 6, name: "Governor", minLevel: 50, minProperties: 15, unlocks: "+60% Gold, the Governors board" },
];

export interface RankStatus {
  current: Rank;
  next: Rank | null;
  level: number;
  propertiesOwned: number;
}

export function computeRank(xp: number, propertiesOwned: number): RankStatus {
  const level = levelFromXp(xp);
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel && propertiesOwned >= r.minProperties) current = r;
  }
  const next = RANKS.find((r) => r.index === current.index + 1) ?? null;
  return { current, next, level, propertiesOwned };
}
