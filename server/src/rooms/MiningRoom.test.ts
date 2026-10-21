import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import type { GeneratedChunk } from "@chimp-arena/shared";
import appConfig from "../app.config";
import { MiningRoomState } from "./MiningRoom";

type State = InstanceType<typeof MiningRoomState>;

/** Polls instead of a fixed sleep - state patches land on the room's own
 *  patch-rate cadence plus real (if local) network round-trips, so a bare
 *  delay is either flaky or wastefully long. Fails loudly if it never
 *  becomes true, rather than silently passing on a stale read. */
async function waitFor(check: () => boolean, timeoutMs = 2000, stepMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  if (!check()) throw new Error(`waitFor() timed out after ${timeoutMs}ms`);
}

describe("MiningRoom (B3 done-when: two test clients move and see each other's rigs update)", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("two clients see each other's position update after a move", async () => {
    const room = await colyseus.createRoom("mining");
    const client1 = await colyseus.connectTo(room);
    const client2 = await colyseus.connectTo(room);

    // Small enough to be legitimately reachable in the near-zero elapsed
    // time since join, under the same speed cap "rejects far beyond the
    // speed cap" below deliberately violates - this test is about sync of
    // an *accepted* move, not about re-testing rejection.
    client1.send("move", { x: 0.3, z: 0.2 });

    // toBeCloseTo, not toBe: position fields are wire-encoded as float32
    // (the right call for a real-time game - half the bytes of float64),
    // so a round-tripped value is 0.30000001192092896, not exactly 0.3.
    await waitFor(() => {
      const p = client2.state.players.get(client1.sessionId);
      return p != null && Math.abs(p.x - 0.3) < 1e-5;
    });
    const seenByClient2 = client2.state.players.get(client1.sessionId);
    expect(seenByClient2?.x).toBeCloseTo(0.3, 5);
    expect(seenByClient2?.z).toBeCloseTo(0.2, 5);
  });

  it("rejects a move far beyond the speed cap", async () => {
    const room = await colyseus.createRoom("mining");
    const client1 = await colyseus.connectTo(room);
    const serverRoom = colyseus.getRoomById<State>(room.roomId);

    // Nowhere near reachable in the time since joining, regardless of speed cap.
    client1.send("move", { x: 9999, z: 9999 });
    await new Promise((resolve) => setTimeout(resolve, 200)); // give a rejected move a chance to (wrongly) land

    const player = serverRoom.state.players.get(client1.sessionId);
    expect(player!.x).toBe(0);
    expect(player!.z).toBe(0);
  });

  it("rejects a move outside world bounds", async () => {
    const room = await colyseus.createRoom("mining");
    const client1 = await colyseus.connectTo(room);
    const serverRoom = colyseus.getRoomById<State>(room.roomId);

    client1.send("move", { x: -5, z: 0 });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const player = serverRoom.state.players.get(client1.sessionId);
    expect(player!.x).toBe(0);
  });

  it("returns the requested chunk, request/response", async () => {
    const room = await colyseus.createRoom("mining");
    const client1 = await colyseus.connectTo(room);

    const chunkPromise = new Promise<GeneratedChunk>((resolve) => {
      client1.onMessage("chunk", resolve);
    });
    client1.send("request_chunk", { cx: 0, cy: 0 });
    const chunk = await chunkPromise;

    expect(chunk.cx).toBe(0);
    expect(chunk.cy).toBe(0);
    expect(Array.isArray(chunk.deposits)).toBe(true);
  });

  it("removes a player from state on leave, while the room stays alive for others", async () => {
    const room = await colyseus.createRoom("mining");
    const client1 = await colyseus.connectTo(room);
    const client2 = await colyseus.connectTo(room); // keeps the room from auto-disposing
    const sessionId = client1.sessionId;
    const serverRoom = colyseus.getRoomById<State>(room.roomId);

    await client1.leave();
    await waitFor(() => !serverRoom.state.players.has(sessionId));

    expect(serverRoom.state.players.has(sessionId)).toBe(false);
    expect(serverRoom.state.players.has(client2.sessionId)).toBe(true);
  });
});
