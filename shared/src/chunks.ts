/**
 * Chunk-space constants and conversions. 1 unit = 1 metre, Y-up, per the
 * team conventions doc (Chalk, A2) - matches the terrain-chunk size Chalk's
 * proof assets (A6) are built against.
 */

/** Metres per chunk side. */
export const CHUNK_SIZE = 256;

/** The world is a fixed 8x8 grid of chunks (matches B5's subscription radius note). */
export const WORLD_CHUNKS = 8;

export interface ChunkCoord {
  cx: number;
  cy: number;
}

/** World-space (x, z) -> the chunk it falls in. */
export function toChunk(x: number, z: number): ChunkCoord {
  return { cx: Math.floor(x / CHUNK_SIZE), cy: Math.floor(z / CHUNK_SIZE) };
}

/**
 * Terrain height at a world position. Stubbed flat (always 0) until real
 * heightmap generation lands - callers should already be written against
 * this signature so that swap-in is just this function's body changing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function heightAt(_x: number, _z: number): number {
  return 0;
}
