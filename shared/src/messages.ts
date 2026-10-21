/**
 * Colyseus room message shapes shared by client and server (B2/B3). Keeping
 * these here, not duplicated in each app, is the whole point of this
 * package - a change to a message shape is one pull request Dee reviews,
 * not a client/server drift bug waiting to happen.
 */
import type { DepositKind } from "./deposits";

/** Client -> server: move intent. Server validates speed cap and world bounds (B3). */
export interface MoveMessage {
  x: number;
  z: number;
}

/** Client -> server: ask for one chunk's generated content. Request/response,
 *  not a push on join - see MiningRoom's own note on why. */
export interface RequestChunkMessage {
  cx: number;
  cy: number;
}

/** Client -> server: start digging a specific deposit. Server validates the
 *  claimed position against its own record of where that player actually is (B4). */
export interface DigStartMessage {
  depositId: string;
}

/** Server -> client: the outcome of a dig, after the server's own timer/cooldown
 *  and hardness check (B4) - never trust a client-reported yield. */
export interface DigResultMessage {
  depositId: string;
  kind: DepositKind;
  amount: number;
  /** Cumulative extracted from this deposit after this dig - feeds hardnessAt(). */
  extractedTotal: number;
}
