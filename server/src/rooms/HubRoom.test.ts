import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import {
  HEADSHOT_DAMAGE,
  inSafeZone,
  MAX_HP,
  SHOT_DAMAGE,
  STARPORTS,
  MAG_SIZE,
  RELOAD_MS,
  FIRE_INTERVAL_MS,
  type HubTravelBroadcast,
  type HubChatBroadcast,
  type HubKillBroadcast,
  type HubRespawnMessage,
  type HubShotBroadcast,
} from "@chimp-arena/shared";
import appConfig from "../app.config";
import { setWorldCovers, setWorldDocks } from "../world-covers";
import { HubRoomState } from "./HubRoom";

type State = InstanceType<typeof HubRoomState>;

async function waitFor(check: () => boolean, timeoutMs = 2000, stepMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  if (!check()) throw new Error(`waitFor() timed out after ${timeoutMs}ms`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = () => sleep(200);

describe("HubRoom (Astroworld)", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("two players see each other move, with names and NFT characters", async () => {
    const room = await colyseus.createRoom("hub");
    const a = await colyseus.connectTo(room, { name: "Sun0x", skin: "rare-deezy-chimp" });
    const b = await colyseus.connectTo(room, { name: "Zee" });
    const server = colyseus.getRoomById<State>(room.roomId);

    const start = server.state.players.get(a.sessionId)!;
    expect(inSafeZone(start.x, start.z)).toBe(true); // everyone spawns in the Core
    const target = { x: start.x + 0.3, z: start.z, ry: 1 };
    a.send("move", target);

    await waitFor(() => Math.abs((b.state.players.get(a.sessionId)?.x ?? NaN) - target.x) < 1e-4);
    const seen = b.state.players.get(a.sessionId)!;
    expect(seen.name).toBe("Sun0x");
    expect(seen.skin).toBe("rare-deezy-chimp");
  });

  it("only accepts real NFT characters", async () => {
    const room = await colyseus.createRoom("hub");
    const a = await colyseus.connectTo(room, { skin: "not-a-chimp" });
    const server = colyseus.getRoomById<State>(room.roomId);
    const p = server.state.players.get(a.sessionId)!;
    expect(p.skin).toBe("std-billy-the-chimp");

    a.send("skin", { skin: "chimp-1of1-kill-boy-tommy" });
    await waitFor(() => p.skin === "chimp-1of1-kill-boy-tommy");
    a.send("skin", { skin: "<script>" });
    await settle();
    expect(p.skin).toBe("chimp-1of1-kill-boy-tommy");
  });

  it("rejects a teleport and a move outside the world", async () => {
    const room = await colyseus.createRoom("hub");
    const a = await colyseus.connectTo(room);
    const server = colyseus.getRoomById<State>(room.roomId);
    const p = server.state.players.get(a.sessionId)!;
    const before = { x: p.x, z: p.z };

    a.send("move", { x: -before.x, z: -before.z, ry: 0 }); // across the plaza instantly
    a.send("move", { x: 5000, z: 0, ry: 0 }); // off the map
    await settle();

    expect(p.x).toBe(before.x);
    expect(p.z).toBe(before.z);
  });

  it("gives an unnamed player a fallback name", async () => {
    const room = await colyseus.createRoom("hub");
    const a = await colyseus.connectTo(room, { name: "   " });
    const server = colyseus.getRoomById<State>(room.roomId);
    expect(server.state.players.get(a.sessionId)!.name).toMatch(/^Chimp-/);
  });

  it("broadcasts chat, masks profanity, and drops spam beyond the burst limit", async () => {
    const room = await colyseus.createRoom("hub");
    const a = await colyseus.connectTo(room, { name: "Sun0x" });
    const b = await colyseus.connectTo(room);

    const lines: HubChatBroadcast[] = [];
    b.onMessage("chat", (line: HubChatBroadcast) => lines.push(line));

    a.send("chat", { text: "  gm   chimps  " });
    a.send("chat", { text: "what the fuck" });
    for (let i = 0; i < 6; i++) a.send("chat", { text: `spam ${i}` });
    await settle();

    expect(lines[0].text).toBe("gm chimps");
    expect(lines[0].from).toBe(a.sessionId);
    expect(lines[1].text).not.toContain("fuck");
    expect(lines.length).toBe(4); // CHAT_BURST
  });

  it("holds a dropped player's spot, but removes a player who leaves on purpose", async () => {
    const room = await colyseus.createRoom("hub");
    const dropper = await colyseus.connectTo(room, { name: "Wifi Blip" });
    const quitter = await colyseus.connectTo(room, { name: "Quitter" });
    await colyseus.connectTo(room); // keeps the room alive
    const server = colyseus.getRoomById<State>(room.roomId);

    await dropper.leave(false); // connection lost, no goodbye
    await quitter.leave(true); // closed the page
    await waitFor(() => !server.state.players.has(quitter.sessionId));
    await settle();

    expect(server.state.players.has(dropper.sessionId)).toBe(true);
    expect(server.state.players.has(quitter.sessionId)).toBe(false);
  });

  describe("combat", () => {
    /** Two players placed out in the districts, 10 m apart on the x axis. */
    async function duel() {
      const room = await colyseus.createRoom("hub");
      const shooter = await colyseus.connectTo(room, { name: "Shooter" });
      const target = await colyseus.connectTo(room, { name: "Target" });
      const server = colyseus.getRoomById<State>(room.roomId);
      const s = server.state.players.get(shooter.sessionId)!;
      const t = server.state.players.get(target.sessionId)!;
      s.x = 200;
      s.z = 0;
      t.x = 210;
      t.z = 0;
      const shots: HubShotBroadcast[] = [];
      const kills: HubKillBroadcast[] = [];
      shooter.onMessage("shot", (m: HubShotBroadcast) => shots.push(m));
      shooter.onMessage("kill", (m: HubKillBroadcast) => kills.push(m));
      shooter.onMessage("chat", () => {});
      return { shooter, target, s, t, shots, kills };
    }
    const body = { o: { x: 200, y: 1.2, z: 0 }, d: { x: 1, y: 0, z: 0 } };
    const head = { o: { x: 200, y: 1.75, z: 0 }, d: { x: 1, y: 0, z: 0 } };

    it("a body shot and a headshot do the right damage, server-side", async () => {
      const { shooter, target, t, shots } = await duel();
      shooter.send("shoot", body);
      await waitFor(() => t.hp === MAX_HP - SHOT_DAMAGE);
      await sleep(150); // fire-rate limit
      shooter.send("shoot", head);
      await waitFor(() => t.hp === MAX_HP - SHOT_DAMAGE - HEADSHOT_DAMAGE);
      await waitFor(() => shots.length === 2);
      expect(shots[0].hit).toBe(target.sessionId);
      expect(shots[0].end.x).toBeCloseTo(209.45, 1); // tracer stops at the capsule
    });

    it("ignores shots faster than the fire rate and shots that miss", async () => {
      const { shooter, t } = await duel();
      shooter.send("shoot", body);
      shooter.send("shoot", body); // same instant - too fast
      shooter.send("shoot", { o: body.o, d: { x: -1, y: 0, z: 0 } }); // wrong way
      await settle();
      expect(t.hp).toBe(MAX_HP - SHOT_DAMAGE);
    });

    it("rejects a shot that claims to start somewhere else", async () => {
      const { shooter, t } = await duel();
      shooter.send("shoot", { o: { x: 208, y: 1.2, z: 0 }, d: body.d }); // point-blank from 8 m away
      await settle();
      expect(t.hp).toBe(MAX_HP);
    });

    it("kills, credits the killer, then respawns the victim in the Core", async () => {
      const { shooter, target, s, t, kills } = await duel();
      const respawn = new Promise<HubRespawnMessage>((resolve) => target.onMessage("respawn", resolve));
      for (let i = 0; i < 3; i++) {
        shooter.send("shoot", head);
        await sleep(130);
      }
      await waitFor(() => !t.alive);
      await waitFor(() => kills.length === 1);
      expect(kills[0]).toMatchObject({ killerName: "Shooter", victimName: "Target", headshot: true });
      expect(s.kills).toBe(1);
      expect(t.deaths).toBe(1);

      const spot = await respawn;
      expect(inSafeZone(spot.x, spot.z)).toBe(true);
      expect(t.alive).toBe(true);
      expect(t.hp).toBe(MAX_HP);
    }, 8000);

    it("nobody can be hurt in the Core, and nobody can shoot from it", async () => {
      const { shooter, s, t } = await duel();
      t.x = 20; // target inside the safe zone
      shooter.send("shoot", { o: { x: 200, y: 1.2, z: 0 }, d: { x: -1, y: 0, z: 0 } });
      await settle();
      expect(t.hp).toBe(MAX_HP);

      t.x = 210;
      s.x = 10; // shooter inside the safe zone
      shooter.send("shoot", { o: { x: 10, y: 1.2, z: 0 }, d: { x: 1, y: 0, z: 0 } });
      await settle();
      expect(t.hp).toBe(MAX_HP);
    });

    it("counts ammo server-side: an empty magazine fires nothing until a reload", async () => {
      const { shooter, t } = await duel();
      // Fire a full magazine (30) plus a few, spaced past the fire-rate limit.
      for (let i = 0; i < MAG_SIZE + 3; i++) {
        shooter.send("shoot", { o: { x: 200, y: 1.2, z: 0 }, d: { x: 0, y: 0, z: 1 } }); // misses: keeps the target alive
        await sleep(FIRE_INTERVAL_MS + 15);
      }
      const shots: HubShotBroadcast[] = [];
      shooter.onMessage("shot", (m: HubShotBroadcast) => shots.push(m));
      // Magazine empty: this one is refused even though it would hit.
      shooter.send("shoot", body);
      await settle();
      expect(t.hp).toBe(MAX_HP);
      expect(shots).toHaveLength(0);
      // After the reload time, shots land again.
      await sleep(RELOAD_MS);
      shooter.send("shoot", body);
      await waitFor(() => t.hp === MAX_HP - SHOT_DAMAGE);
    }, 20000);

    it("buildings stop bullets: no hits through a wall, and the tracer ends at it", async () => {
      const { shooter, t, shots } = await duel();
      setWorldCovers([[205, 0, 1.5, 6]]); // a building between them
      try {
        shooter.send("shoot", body);
        await waitFor(() => shots.length === 1);
        expect(t.hp).toBe(MAX_HP);
        expect(shots[0].hit).toBeNull();
        expect(shots[0].end.x).toBeCloseTo(203.5, 1);

        await sleep(150);
        // A lob over the top of a low building still lands.
        setWorldCovers([[205, 0, 1.5, 1]]);
        shooter.send("shoot", body);
        await waitFor(() => t.hp === MAX_HP - SHOT_DAMAGE);
      } finally {
        setWorldCovers([]);
      }
    });
  });

  describe("starports", () => {
    it("flies a player from a starport to another, server-side, with a cooldown", async () => {
      const room = await colyseus.createRoom("hub");
      const c = await colyseus.connectTo(room, { name: "Flyer" });
      const server = colyseus.getRoomById<State>(room.roomId);
      const p = server.state.players.get(c.sessionId)!;
      const arrivals: HubTravelBroadcast[] = [];
      c.onMessage("travel", (m: HubTravelBroadcast) => arrivals.push(m));

      const [core, belt, rim] = STARPORTS;
      // Far from any ship: refused.
      p.x = 0;
      p.z = 0;
      c.send("travel", { to: belt.id });
      await settle();
      expect(arrivals).toHaveLength(0);

      // At the Core starport: flies to the Belt and lands next to its pad.
      p.x = core.x;
      p.z = core.z;
      c.send("travel", { to: belt.id });
      await waitFor(() => arrivals.length === 1);
      expect(arrivals[0].to).toBe(belt.id);
      expect(Math.hypot(p.x - belt.x, p.z - belt.z)).toBeLessThan(25);

      // Straight back again: too soon.
      p.x = belt.x;
      p.z = belt.z;
      c.send("travel", { to: rim.id });
      await settle();
      expect(arrivals).toHaveLength(1);
    });

    it("lets you board a docked ship, but not fly to where you already are", async () => {
      setWorldDocks([{ id: "dock-1", x: 300, z: 300 }]);
      try {
        const room = await colyseus.createRoom("hub");
        const c = await colyseus.connectTo(room, { name: "Docker" });
        const server = colyseus.getRoomById<State>(room.roomId);
        const p = server.state.players.get(c.sessionId)!;
        const arrivals: HubTravelBroadcast[] = [];
        c.onMessage("travel", (m: HubTravelBroadcast) => arrivals.push(m));

        p.x = STARPORTS[0].x;
        p.z = STARPORTS[0].z;
        c.send("travel", { to: STARPORTS[0].id });
        await settle();
        expect(arrivals).toHaveLength(0);

        p.x = 305;
        p.z = 300;
        c.send("travel", { to: STARPORTS[0].id });
        await waitFor(() => arrivals.length === 1);
        expect(arrivals[0].to).toBe(STARPORTS[0].id);
      } finally {
        setWorldDocks([]);
      }
    });
  });
});
