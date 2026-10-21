/**
 * Deterministic world generation (B2). The same (seed, genVersion, cx, cy)
 * always produces the same chunk - this is what lets the server and every
 * client agree on a chunk's contents from just four numbers, instead of the
 * server having to transmit full chunk state to everyone who enters it.
 *
 * genVersion exists so the generation rules can change later (better
 * deposit density, new deposit kinds) without breaking determinism for
 * anything still pinned to an older version.
 */
import { hash32, mulberry32 } from "./rng";
import { CHUNK_SIZE } from "./chunks";
import type { DepositKind } from "./deposits";

export interface ChunkDeposit {
  /** Stable across regenerations of the same chunk - used as the dig target id. */
  id: string;
  kind: DepositKind;
  /** Local chunk-space position in metres, [0, CHUNK_SIZE). */
  x: number;
  z: number;
}

export interface GeneratedChunk {
  cx: number;
  cy: number;
  genVersion: number;
  deposits: ChunkDeposit[];
}

const DEPOSIT_KINDS: DepositKind[] = ["gold", "diamond", "ruby"];

export function generateChunk(seed: number, genVersion: number, cx: number, cy: number): GeneratedChunk {
  const chunkSeed = hash32(`${seed}:${genVersion}:${cx}:${cy}`);
  const rand = mulberry32(chunkSeed);

  const deposits: ChunkDeposit[] = [];
  const count = 3 + Math.floor(rand() * 5); // 3-7 per chunk - placeholder density, tune later
  for (let i = 0; i < count; i++) {
    const kind = DEPOSIT_KINDS[Math.floor(rand() * DEPOSIT_KINDS.length)];
    deposits.push({
      id: `${cx}_${cy}_${i}`,
      kind,
      x: rand() * CHUNK_SIZE,
      z: rand() * CHUNK_SIZE,
    });
  }

  return { cx, cy, genVersion, deposits };
}
