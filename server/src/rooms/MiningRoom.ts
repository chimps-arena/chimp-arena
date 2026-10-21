/**
 * B3 - the first real multiplayer room: player schema, join/leave, movement
 * validation (speed cap + world bounds), and minimal chunk loading on spawn
 * (the full interest-management/subscription-radius version is B5 - this
 * just proves a player gets *a* chunk, not the whole-world-at-once problem
 * B5 solves).
 *
 * Movement is never trusted at face value - every "move" message is checked
 * against how far the player could plausibly have travelled since their
 * last accepted move, the same "server tracks the real progression, not a
 * single self-reported number" principle the mining permit's proof-of-
 * progress pings already use elsewhere in this project.
 *
 * Chunk loading is request/response ("request_chunk" -> "chunk"), not a
 * push on join - a client that sends a message only after it has attached
 * its own handlers can never race a server message sent before those
 * handlers existed, and real players will need to request many chunks as
 * they move anyway, not just once at spawn.
 */
import { Client, Room } from "@colyseus/core";
import { schema, t } from "@colyseus/schema";
import { generateChunk, inWorldBounds, MAX_SPEED_MPS } from "@chimp-arena/shared";
import type { MoveMessage, RequestChunkMessage } from "@chimp-arena/shared";

export const Player = schema(
  {
    x: t.number().default(0),
    z: t.number().default(0),
  },
  "Player",
);

export const MiningRoomState = schema(
  {
    players: t.map(Player),
  },
  "MiningRoomState",
);

/** Per-player last-accepted-move timestamp, for the speed-cap check below.
 *  Keyed on the player schema instance itself, not sessionId - cleared
 *  automatically with the player on leave since nothing else holds a
 *  reference to a stale entry. */
const lastMoveAt = new WeakMap<InstanceType<typeof Player>, number>();

const WORLD_SEED = 1234; // placeholder - real per-world seeding is a later (persistence) task.
const GEN_VERSION = 1;

export class MiningRoom extends Room<{ state: InstanceType<typeof MiningRoomState> }> {
  onCreate(): void {
    this.state = new MiningRoomState();

    this.onMessage("move", (client, message: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof message?.x !== "number" || typeof message?.z !== "number") return;

      if (!inWorldBounds(message.x, message.z)) return;

      const now = Date.now();
      const lastAt = lastMoveAt.get(player) ?? now;
      const elapsedSec = Math.max(0, (now - lastAt) / 1000);
      const maxDist = MAX_SPEED_MPS * elapsedSec + 0.5; // small slack for tick/network jitter
      const dx = message.x - player.x;
      const dz = message.z - player.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > maxDist) return; // too far, too fast - reject silently, same position stands

      player.x = message.x;
      player.z = message.z;
      lastMoveAt.set(player, now);
    });

    this.onMessage("request_chunk", (client, message: RequestChunkMessage) => {
      if (typeof message?.cx !== "number" || typeof message?.cy !== "number") return;
      client.send("chunk", generateChunk(WORLD_SEED, GEN_VERSION, message.cx, message.cy));
    });
  }

  onJoin(client: Client): void {
    const player = new Player();
    this.state.players.set(client.sessionId, player);
    lastMoveAt.set(player, Date.now());
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }
}
