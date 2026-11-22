/**
 * Astroworld's ground: one deterministic height function shared by the game
 * (drawing the land, putting feet on it) and the server (where players and
 * shots really are). Same inputs, same hills, everywhere.
 *
 * Everywhere people build, walk or fight on purpose stays flat at y = 0: the
 * Core, the roads, the districts, the Arena, the starports and the hideout.
 * Between them the land rolls into hills, ridges and a few big craters, and
 * rises into mountains at the edge of the world.
 *
 * Players' `y` stays "height above the ground" (jumping); absolute height is
 * groundHeight(x, z) + y.
 */
import { ARENA, DISTRICTS, LOT_SPACING, ROAD_ANGLES, SAFE_RADIUS, STARPORTS, WORLD_RADIUS } from "./world-layout";

/* ------------------------------ noise ------------------------------ */

function hash(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise, 0..1. */
function noise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Rolling hills, 0..1. */
function fbm(x: number, z: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    sum += amp * noise(x * f + i * 17.1, z * f - i * 9.3);
    f *= 2;
    amp *= 0.5;
  }
  return sum / 0.9375;
}

/** Sharp ridgelines, 0..1. */
function ridges(x: number, z: number): number {
  let sum = 0;
  let amp = 0.6;
  let f = 1;
  for (let i = 0; i < 3; i++) {
    const n = 1 - Math.abs(noise(x * f + 31.7, z * f + 5.2) * 2 - 1);
    sum += amp * n * n;
    f *= 2.1;
    amp *= 0.45;
  }
  return sum / 0.98;
}

/* ------------------------------ landmarks ------------------------------ */

/** Big craters with raised rims: named places on the map. */
export const CRATERS: { name: string; x: number; z: number; r: number; depth: number }[] = [
  { name: "Grey Expanse Crater", x: 300, z: 110, r: 70, depth: 10 },
  { name: "Old Strike Crater", x: -330, z: 330, r: 55, depth: 9 },
  { name: "Deep Basin", x: 40, z: -470, r: 80, depth: 12 },
];

const DISTRICT_HALF = LOT_SPACING * 3.6;

/** Distance from point to a segment, in the XZ plane. */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

/** How far (m) the point is from the nearest place that must stay flat. Negative = inside one. */
function flatDistance(x: number, z: number): number {
  let d = Math.hypot(x, z) - (SAFE_RADIUS + 20);
  for (const dist of DISTRICTS) {
    const dx = Math.max(Math.abs(x - dist.x) - DISTRICT_HALF - 16, 0);
    const dz = Math.max(Math.abs(z - dist.z) - DISTRICT_HALF - 16, 0);
    d = Math.min(d, Math.hypot(dx, dz) - (dx === 0 && dz === 0 ? 1 : 0));
  }
  ROAD_ANGLES.forEach((a, i) => {
    const end = Math.hypot(DISTRICTS[i].x, DISTRICTS[i].z);
    d = Math.min(d, segDist(x, z, 0, 0, Math.sin(a) * end, Math.cos(a) * end) - 28);
  });
  d = Math.min(d, Math.hypot(x - ARENA.x, z - ARENA.z) - (ARENA.radius + 26));
  for (const s of STARPORTS) d = Math.min(d, Math.hypot(x - s.x, z - s.z) - 20);
  // Tommy's hideout (Chapter 2), between the Belt and the Rim.
  d = Math.min(d, Math.hypot(x - Math.sin(Math.PI / 3) * 470, z - Math.cos(Math.PI / 3) * 470) - 24);
  return d;
}

/* ------------------------------ the height ------------------------------ */

const BLEND = 45;

/** Ground height (m) at a point. Flat (0) wherever people build and travel. */
export function groundHeight(x: number, z: number): number {
  const wild = smooth(Math.max(0, Math.min(1, flatDistance(x, z) / BLEND)));
  if (wild <= 0) return 0;
  let h = fbm(x / 160, z / 160) * 16 + ridges(x / 110, z / 110) * 14;
  for (const c of CRATERS) {
    const r = Math.hypot(x - c.x, z - c.z) / c.r;
    if (r < 1.6) {
      // Bowl inside, raised rim at r = 1, fading out by 1.6.
      const bowl = r < 1 ? -c.depth * (1 - r * r) : 0;
      const rim = Math.exp(-((r - 1) * (r - 1)) / 0.03) * c.depth * 0.9;
      h += bowl + rim;
    }
  }
  // Mountains ringing the edge of the world.
  const edge = smooth(Math.max(0, Math.min(1, (Math.hypot(x, z) - (WORLD_RADIUS - 110)) / 110)));
  h += edge * (35 + ridges(x / 60, z / 60) * 35);
  return h * wild;
}

/** Shot stopped by the land itself: first point along the ray that's under ground, or maxT. */
export function terrainBlockedAt(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxT: number): number {
  const STEP = 3;
  for (let t = STEP; t < maxT; t += STEP) {
    const x = o.x + d.x * t;
    const z = o.z + d.z * t;
    const y = o.y + d.y * t;
    if (y < groundHeight(x, z) - 0.1) return Math.max(0, t - STEP / 2);
  }
  return maxT;
}
