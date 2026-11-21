// Dev tool: fills Astroworld with NFT-character bots that wander the Core,
// drive out to the districts, and shoot each other in the combat zones.
//
//   node scripts/hub-bots.mjs [count=6] [serverUrl=http://localhost:2567]
//
// Bots play by the same rules as people - the server checks their speed and
// resolves their shots - so this doubles as a smoke test. Ctrl+C to stop.
//   HUB_BOTS_SECONDS=20 node scripts/hub-bots.mjs   -> run, check, exit 0/1
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { Client } = require("@colyseus/sdk");

const COUNT = Number(process.argv[2] ?? 6);
const SERVER = process.argv[3] ?? "http://localhost:2567";
const CHARACTERS = JSON.parse(readFileSync(new URL("../shared/src/characters.json", import.meta.url), "utf8"));

// Mirrors shared/src/world-layout.ts + hub.ts (plain .mjs can't import the TS).
const SAFE_RADIUS = 70;
const DISTRICT_DISTANCE = 205;
const DISTRICTS = [0, 120, 240].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a) * DISTRICT_DISTANCE, z: Math.cos(a) * DISTRICT_DISTANCE };
});
const WALK = 5.2;
const SPRINT = 8.4;
const FIRE_MS = 140;

// Everyone wants to see the headline characters first.
const FEATURED = ["rare-deezy-chimp", "chimp-1of1-kill-boy-tommy", "std-weapon-specialist-ryan", "rare-lady-winter", "std-castro", "rare-bad-mike", "chimp-1of1-napoleon", "rare-eva"];
const picks = [...FEATURED.map((id) => CHARACTERS.find((c) => c.id === id)).filter(Boolean), ...CHARACTERS.filter((c) => !FEATURED.includes(c.id)).sort(() => Math.random() - 0.5)];
const LINES = ["gm chimps", "anyone selling a rover?", "who owns the Armory?", "meet at the Belt", "wagmi", "nice fit", "Helios Docks is wild", "gg"];

const inSafe = (x, z) => x * x + z * z <= SAFE_RADIUS * SAFE_RADIUS;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function corePoint() {
  const a = Math.random() * Math.PI * 2;
  const r = 12 + Math.random() * 30;
  return { x: Math.sin(a) * r, z: Math.cos(a) * r };
}

/** A route out along a road into a district's streets (and the way back). */
function patrolRoute() {
  const d = DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)];
  const a = Math.atan2(d.x, d.z);
  const gate = { x: Math.sin(a) * (SAFE_RADIUS - 4), z: Math.cos(a) * (SAFE_RADIUS - 4) };
  const route = [gate, { x: d.x * 0.62, z: d.z * 0.62 }, { x: d.x + 13, z: d.z + 13 }];
  for (let i = 0; i < 4; i++) {
    const last = route[route.length - 1];
    const step = (Math.random() < 0.5 ? 1 : -1) * 26;
    route.push(Math.random() < 0.5 ? { x: last.x + step, z: last.z } : { x: last.x, z: last.z + step });
  }
  return [...route, { x: d.x * 0.62, z: d.z * 0.62 }, gate, corePoint()];
}

const bots = [];

async function bot(i) {
  const look = picks[i % picks.length];
  const room = await new Client(SERVER).joinOrCreate("hub", { name: look.name, skin: look.id });
  room.onMessage("chat", () => {});
  room.onMessage("shot", () => {});
  room.onMessage("kill", () => {});
  await new Promise((r) => setTimeout(r, 300)); // first state patch

  const me = room.state.players.get(room.sessionId);
  const b = { i, room, look, x: me.x, z: me.z, ry: me.ry, route: [], spawn: { x: me.x, z: me.z }, lastShot: 0, shots: 0 };
  // Half the bots head out to fight; the rest hang around the plaza.
  b.route = i % 2 === 0 ? patrolRoute() : [corePoint()];

  room.onMessage("respawn", (spot) => {
    b.x = spot.x;
    b.z = spot.z;
    b.route = Math.random() < 0.6 ? patrolRoute() : [corePoint()];
  });

  let last = Date.now();
  b.tick = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    const self = room.state.players.get(room.sessionId);
    if (!self || !self.alive) return;

    // Fight: anyone else out in the open nearby?
    if (!inSafe(b.x, b.z)) {
      let foe = null;
      room.state.players.forEach((p, id) => {
        if (id === room.sessionId || !p.alive || inSafe(p.x, p.z)) return;
        const d = dist(b, p);
        if (d < 45 && (!foe || d < foe.d)) foe = { p, d };
      });
      if (foe) {
        b.ry = Math.atan2(foe.p.x - b.x, foe.p.z - b.z);
        if (now - b.lastShot > FIRE_MS) {
          b.lastShot = now;
          b.shots++;
          const o = { x: b.x + Math.sin(b.ry) * 0.8, y: 1.42, z: b.z + Math.cos(b.ry) * 0.8 };
          const aimY = foe.p.y + (Math.random() < 0.2 ? 1.75 : 1.1);
          const miss = () => (Math.random() - 0.5) * 0.08;
          const dx = foe.p.x - o.x;
          const dy = aimY - o.y;
          const dz = foe.p.z - o.z;
          const len = Math.hypot(dx, dy, dz);
          room.send("shoot", { o, d: { x: dx / len + miss(), y: dy / len + miss() * 0.5, z: dz / len + miss() } });
        }
        room.send("move", { x: b.x, z: b.z, ry: b.ry, y: 0, pitch: 0, crouch: Math.random() < 0.02 });
        return;
      }
    }

    // Walk the route.
    const target = b.route[0];
    if (!target) {
      b.route = Math.random() < 0.35 ? patrolRoute() : [corePoint()];
      return;
    }
    const dx = target.x - b.x;
    const dz = target.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) {
      b.route.shift();
      return;
    }
    const speed = inSafe(b.x, b.z) ? WALK : SPRINT;
    const step = Math.min(d, speed * dt);
    b.x += (dx / d) * step;
    b.z += (dz / d) * step;
    b.ry = Math.atan2(dx, dz);
    room.send("move", { x: b.x, z: b.z, ry: b.ry, y: 0, pitch: 0 });
  }, 100);

  b.social = setInterval(() => {
    if (inSafe(b.x, b.z) && Math.random() < 0.25) room.send("chat", { text: LINES[Math.floor(Math.random() * LINES.length)] });
  }, 6000 + i * 700);

  room.onLeave(() => {
    clearInterval(b.tick);
    clearInterval(b.social);
  });
  bots.push(b);
  return b;
}

await Promise.all(Array.from({ length: COUNT }, (_, i) => bot(i)));
console.log(`${bots.length} bots in Astroworld (${SERVER}): ${bots.map((b) => b.look.name).join(", ")}. Ctrl+C to stop.`);

let kills = 0;
let chats = 0;
bots[0].room.onMessage("kill", (k) => {
  kills++;
  console.log(`[kill] ${k.killerName} ${k.headshot ? "headshot" : "eliminated"} ${k.victimName}`);
});
bots[0].room.onMessage("chat", (line) => {
  chats++;
  console.log(`[chat] ${line.name}: ${line.text}`);
});

if (process.env.HUB_BOTS_SECONDS) {
  setTimeout(async () => {
    const state = bots[0].room.state;
    const seen = state.players.size;
    const moved = bots.filter((b) => {
      const p = state.players.get(b.room.sessionId);
      return p && Math.hypot(p.x - b.spawn.x, p.z - b.spawn.z) > 2;
    }).length;
    const skins = bots.filter((b) => state.players.get(b.room.sessionId)?.skin === b.look.id).length;
    const shots = bots.reduce((n, b) => n + b.shots, 0);
    console.log(`check: ${seen}/${COUNT} players seen, ${moved}/${COUNT} moved (server-accepted), ${skins}/${COUNT} wearing their NFT character, ${shots} shots, ${kills} kills, ${chats} chat lines`);
    await Promise.all(bots.map((b) => b.room.leave()));
    process.exit(seen === COUNT && moved === COUNT && skins === COUNT ? 0 : 1);
  }, Number(process.env.HUB_BOTS_SECONDS) * 1000);
}
