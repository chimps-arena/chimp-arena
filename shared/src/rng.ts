/**
 * Deterministic seeded RNG - same shape as the existing lib/game/rng.ts in
 * the Next.js client, duplicated here (not imported) because shared/ must
 * not depend on the client app; the two are free to converge later if the
 * client's own usage gets migrated onto this package.
 */

/** Deterministic 32-bit hash of a string (FNV-1a). */
export function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
