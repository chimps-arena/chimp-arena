/**
 * Movement rules both the client (prediction/feel) and the server (B4's
 * actual validation) must agree on - one source of truth instead of two
 * numbers that quietly drift apart.
 */
import { CHUNK_SIZE, WORLD_CHUNKS } from "./chunks";

/** Metres per second - a generous human-run pace, not a vehicle speed. */
export const MAX_SPEED_MPS = 8;

/** The whole world's extent in metres, from the chunk grid size. */
export const WORLD_SIZE = CHUNK_SIZE * WORLD_CHUNKS;

export function inWorldBounds(x: number, z: number): boolean {
  return x >= 0 && x < WORLD_SIZE && z >= 0 && z < WORLD_SIZE;
}
