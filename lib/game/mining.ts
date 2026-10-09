/**
 * Mining mission constants - tool tiers, depth zones, and the server-side
 * yield roll. A run's score is just depth reached; the server never trusts
 * a client-reported resource haul, it rolls the actual yield itself from
 * depth + tool tier (same spirit as the tier roll in
 * app/api/mint/claim/route.ts's rollTier()).
 */

export type ResourceKind = "cobalt" | "palladium" | "crystal";
type Haul = Record<"gold" | ResourceKind, number>;

export interface MiningTool {
  tier: 0 | 1 | 2;
  name: string;
  /** Relative dig speed - higher reaches more depth in the same time. */
  digPower: number;
  /** Multiplies rolled resource amounts. */
  yieldMult: number;
  /** Caps how fast depth can increase - the server validates a submitted
   *  depth against this, never the client's own timing. */
  maxRowsPerSec: number;
}

export const TOOLS: MiningTool[] = [
  { tier: 0, name: "Pickaxe", digPower: 1, yieldMult: 1, maxRowsPerSec: 2.5 },
  { tier: 1, name: "Drill", digPower: 1.6, yieldMult: 1.25, maxRowsPerSec: 4 },
  { tier: 2, name: "Plasma Cutter", digPower: 2.4, yieldMult: 1.5, maxRowsPerSec: 6 },
];

export interface MiningZone {
  name: string;
  /** Depth this zone starts at. */
  from: number;
}

export const ZONES: MiningZone[] = [
  { name: "Topsoil", from: 0 },
  { name: "Cobalt Seam", from: 60 },
  { name: "Palladium Vein", from: 160 },
  { name: "Crystal Caverns", from: 300 },
];

export function zoneIndexFor(depth: number): number {
  let idx = 0;
  for (let i = 0; i < ZONES.length; i++) {
    if (depth >= ZONES[i].from) idx = i;
  }
  return idx;
}

export function zoneNameFor(depth: number): string {
  return ZONES[zoneIndexFor(depth)].name;
}

/** A run's oxygen/time budget, in seconds. */
export const OXYGEN_SEC = 90;

/**
 * Server-side ceiling for a submitted depth, given tool tier (from the
 * signed start token, never the client) and elapsed time - plays the same
 * role MISSION_RULES[slug].validate() plays for every other mission.
 */
export function maxDepthFor(tier: number, elapsedSec: number): number {
  const tool = TOOLS[tier] ?? TOOLS[0];
  // A little slack past the oxygen budget for networking/render lag, not
  // an invitation to run long - submit is also bounded by the usual 0-900s
  // elapsed window every mission enforces.
  const cappedElapsed = Math.min(elapsedSec, OXYGEN_SEC + 30);
  return Math.floor(cappedElapsed * tool.maxRowsPerSec) + 10;
}

const ZONE_WEIGHTS: Record<number, Partial<Haul>> = {
  0: { gold: 100 },
  1: { gold: 55, cobalt: 45 },
  2: { gold: 30, cobalt: 45, palladium: 25 },
  3: { gold: 20, cobalt: 35, palladium: 30, crystal: 15 },
};

const AMOUNT_RANGE: Record<keyof Haul, [number, number]> = {
  gold: [3, 8],
  cobalt: [2, 5],
  palladium: [1, 2],
  crystal: [1, 1],
};

/**
 * Weighted resource draw per depth reached - deeper zones unlock rarer
 * resources at better odds, more draws at greater depth. This is what
 * bounds the maximum a single permit can ever pay out (10 draws, max
 * per-draw amount, max tool multiplier), independent of anything the
 * client reports.
 */
export function rollMiningYield(
  depth: number,
  tier: number,
  rand: () => number = Math.random,
): Haul {
  const zone = zoneIndexFor(depth);
  const tool = TOOLS[tier] ?? TOOLS[0];
  const draws = Math.min(10, 1 + Math.floor(depth / 30));
  const table = ZONE_WEIGHTS[zone] ?? ZONE_WEIGHTS[0];
  const entries = Object.entries(table) as [keyof Haul, number][];
  const totalWeight = entries.reduce((s, [, w]) => s + w, 0);

  const totals: Haul = { gold: 0, cobalt: 0, palladium: 0, crystal: 0 };
  for (let i = 0; i < draws; i++) {
    let r = rand() * totalWeight;
    let picked: keyof Haul = entries[0][0];
    for (const [key, w] of entries) {
      if (r < w) {
        picked = key;
        break;
      }
      r -= w;
    }
    const [lo, hi] = AMOUNT_RANGE[picked];
    totals[picked] += lo + Math.floor(rand() * (hi - lo + 1));
  }

  for (const key of Object.keys(totals) as (keyof Haul)[]) {
    totals[key] = Math.round(totals[key] * tool.yieldMult);
  }
  return totals;
}
