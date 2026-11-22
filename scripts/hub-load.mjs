// Load test for the Astroworld game server: how many players can one server hold?
//
//   node scripts/hub-load.mjs [serverUrl=http://localhost:2567] [steps=25,50,100,150,200] [holdSeconds=30]
//
// Ramps up virtual players in steps. Each one plays like a real person on the
// wire: sends its position 15x a second, about half head out to the combat
// zones and shoot at whoever is near, the rest mill around the Core, and some
// chat. Every step holds for a while and reports:
//   - joins (time, failures)
//   - round-trip ping p50 / p95 (Colyseus ping, every 2 s per player)
//   - state updates received per player per second (smoothness)
//   - the server's own CPU, memory and event-loop delay (from /health)
//   - this machine's event-loop delay (if THIS is overloaded, the numbers lie)
// It stops early when the server is clearly struggling.
//
// Bots join with { lane: "load" }, so the server puts them in their own rooms:
// real players are never matched in with them.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const { Client } = require("@colyseus/sdk");

const SERVER = process.argv[2] ?? "http://localhost:2567";
const STEPS = (process.argv[3] ?? "25,50,100,150,200").split(",").map(Number);
const HOLD_S = Number(process.argv[4] ?? 30);
const CHARACTERS = JSON.parse(readFileSync(new URL("../shared/src/characters.json", import.meta.url), "utf8"));

// Mirrors shared/src (plain .mjs can't import the TS).
const SAFE_RADIUS = 110;
const SEND_EVERY_MS = 66;
const SPEED = 8.4; // sprint, under the server's walk cap
const FIRE_MS = 150;
const JOIN_PER_SECOND = 10;
// Several copies can run side by side (one per CPU core) to reach higher
// counts; give each its own LOAD_ID_OFFSET so bot names don't clash.
const ID_OFFSET = Number(process.env.LOAD_ID_OFFSET ?? 0);

// Stop when the server is clearly over its limit.
const LIMITS = { pingP95: 400, loopP99: 150, joinFailPct: 10 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : "-");

const local = monitorEventLoopDelay({ resolution: 10 });
local.enable();

const bots = [];
let stats = freshStats();
function freshStats() {
  return { joins: [], joinFails: 0, failReasons: new Map(), pings: [], patches: 0, drops: 0, kills: 0, since: Date.now() };
}

async function health() {
  try {
    const res = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(5000) });
    return await res.json();
  } catch {
    return null;
  }
}

async function spawnBot(i) {
  const look = CHARACTERS[i % CHARACTERS.length];
  const fighter = i % 2 === 0;
  const t0 = performance.now();
  let room;
  try {
    room = await new Client(SERVER).joinOrCreate("hub", { name: `Load ${i}`, skin: look.id, lane: "load" });
  } catch (e) {
    stats.joinFails++;
    const why = String(e?.message ?? e).slice(0, 80);
    stats.failReasons.set(why, (stats.failReasons.get(why) ?? 0) + 1);
    return;
  }
  stats.joins.push(performance.now() - t0);

  const b = { room, x: 0, z: 0, ry: 0, goal: null, fighter, timers: [], gone: false };
  bots.push(b);
  // Handlers first: messages can arrive before the state has synced.
  room.onStateChange(() => stats.patches++);
  room.onMessage("respawn", (s) => {
    b.x = s.x;
    b.z = s.z;
    b.goal = null;
  });
  room.onMessage("kill", () => stats.kills++);
  room.onMessage("shot", () => {});
  room.onMessage("chat", () => {});
  room.onLeave(() => {
    if (!b.gone) stats.drops++;
    b.gone = true;
  });

  // Wait for our own player to appear in the synced state.
  for (let w = 0; w < 150; w++) {
    const me = room.state?.players?.get(room.sessionId);
    if (me) {
      b.x = me.x;
      b.z = me.z;
      break;
    }
    await sleep(100);
  }


  let lastShot = 0;
  b.timers.push(
    setInterval(() => {
      if (b.gone) return;
      const dt = SEND_EVERY_MS / 1000;
      if (!b.goal || Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 2) {
        // Fighters roam a ring just outside the safe zone (where the action is); others the Core plaza.
        const a = Math.random() * Math.PI * 2;
        const r = b.fighter ? SAFE_RADIUS + 8 + Math.random() * 40 : 12 + Math.random() * 40;
        b.goal = { x: Math.sin(a) * r, z: Math.cos(a) * r };
      }
      const dx = b.goal.x - b.x;
      const dz = b.goal.z - b.z;
      const len = Math.hypot(dx, dz) || 1;
      const step = Math.min(len, SPEED * dt);
      b.x += (dx / len) * step;
      b.z += (dz / len) * step;
      b.ry = Math.atan2(dx, dz);
      room.send("move", { x: b.x, z: b.z, y: 0, ry: b.ry, pitch: 0, crouch: false });

      // Shoot the nearest player in range, with some misses, like a person would.
      const now = Date.now();
      if (b.fighter && now - lastShot > FIRE_MS && Math.hypot(b.x, b.z) > SAFE_RADIUS + 1) {
        let best = null;
        let bd = 60;
        room.state?.players?.forEach((p, id) => {
          if (id === room.sessionId || !p.alive) return;
          const d = Math.hypot(p.x - b.x, p.z - b.z);
          if (d < bd) {
            bd = d;
            best = p;
          }
        });
        if (best) {
          lastShot = now;
          const o = { x: b.x, y: 1.4, z: b.z };
          const miss = () => (Math.random() - 0.5) * 0.08;
          const tx = best.x - o.x;
          const ty = best.y + 1.2 - o.y;
          const tz = best.z - o.z;
          const l = Math.hypot(tx, ty, tz) || 1;
          room.send("shoot", { o, d: { x: tx / l + miss(), y: ty / l + miss(), z: tz / l + miss() } });
        }
      }
    }, SEND_EVERY_MS),
  );
  b.timers.push(
    setInterval(() => {
      if (!b.gone) room.ping((ms) => stats.pings.push(ms));
    }, 2000),
  );
  b.timers.push(
    setInterval(() => {
      if (!b.gone && Math.random() < 0.1) room.send("chat", { text: "load test" });
    }, 10_000),
  );
}

async function shutdown() {
  for (const b of bots) {
    b.gone = true;
    b.timers.forEach(clearInterval);
    try {
      await b.room.leave(true);
    } catch {
      /* already gone */
    }
  }
}
process.on("SIGINT", async () => {
  await shutdown();
  process.exit(130);
});

console.log(`Load test -> ${SERVER}  steps ${STEPS.join(", ")}  hold ${HOLD_S}s each\n`);
const base = await health();
if (!base?.ok) {
  console.log("Server /health not reachable - is it running?");
  process.exit(1);
}
console.log(`baseline: cpu ${base.cpuPct ?? "?"}%  rss ${base.rssMb ?? "?"} MB  loop p99 ${base.loopDelayMs?.p99 ?? "?"} ms  hub ${JSON.stringify(base.hub ?? {})}\n`);
console.log("players | rooms | join p50/p95 ms | fails | ping p50/p95/p99 ms | updates/s per player | server cpu% | rss MB | server loop p99/max ms | here loop p99 ms | kills | drops");

const results = [];
let target = 0;
for (const n of STEPS) {
  // Ramp to n players.
  while (target < n) {
    const batch = Math.min(JOIN_PER_SECOND, n - target);
    await Promise.all(Array.from({ length: batch }, (_, k) => spawnBot(ID_OFFSET + target + k)));
    target += batch;
    await sleep(1000);
  }
  // Settle, then measure over the hold.
  await sleep(5000);
  await health(); // resets the server's CPU/loop window
  local.reset();
  const joinStats = stats;
  stats = { ...freshStats(), joins: joinStats.joins, joinFails: joinStats.joinFails, failReasons: joinStats.failReasons };
  const serverSamples = [];
  const end = Date.now() + HOLD_S * 1000;
  while (Date.now() < end) {
    await sleep(3000);
    const h = await health();
    if (h) serverSamples.push(h);
  }
  const live = bots.filter((b) => !b.gone).length;
  const seconds = (Date.now() - stats.since) / 1000;
  const last = serverSamples.at(-1) ?? {};
  const row = {
    players: live,
    rooms: last.hub?.rooms ?? NaN,
    joinP50: pct(stats.joins, 50),
    joinP95: pct(stats.joins, 95),
    joinFails: stats.joinFails,
    pingP50: pct(stats.pings, 50),
    pingP95: pct(stats.pings, 95),
    pingP99: pct(stats.pings, 99),
    updates: live ? stats.patches / live / seconds : 0,
    cpu: Math.max(...serverSamples.map((s) => s.cpuPct ?? 0)),
    rss: Math.max(...serverSamples.map((s) => s.rssMb ?? 0)),
    loopP99: Math.max(...serverSamples.map((s) => s.loopDelayMs?.p99 ?? 0)),
    loopMax: Math.max(...serverSamples.map((s) => s.loopDelayMs?.max ?? 0)),
    hereLoop: Math.max(0, local.percentile(99) / 1e6 - 10),
    kills: stats.kills,
    drops: stats.drops,
  };
  results.push(row);
  console.log(
    [
      row.players,
      row.rooms,
      `${fmt(row.joinP50)}/${fmt(row.joinP95)}`,
      row.joinFails,
      `${fmt(row.pingP50)}/${fmt(row.pingP95)}/${fmt(row.pingP99)}`,
      fmt(row.updates, 1),
      fmt(row.cpu, 1),
      row.rss,
      `${fmt(row.loopP99, 1)}/${fmt(row.loopMax, 1)}`,
      fmt(row.hereLoop, 1),
      row.kills,
      row.drops,
    ].join(" | "),
  );
  if (stats.failReasons.size) console.log("   join failures:", Object.fromEntries(stats.failReasons));

  const failPct = (100 * row.joinFails) / Math.max(1, n);
  if (row.pingP95 > LIMITS.pingP95 || row.loopP99 > LIMITS.loopP99 || failPct > LIMITS.joinFailPct) {
    console.log(`\nStopping: over the limit at ${row.players} players (ping p95 > ${LIMITS.pingP95} ms, server loop p99 > ${LIMITS.loopP99} ms, or > ${LIMITS.joinFailPct}% failed joins).`);
    break;
  }
}

await shutdown();
console.log("\nJSON:", JSON.stringify(results));
process.exit(0);
