/**
 * The world map's background: Astroworld's real ground seen from above.
 *
 * Sampled from the same groundHeight() the game and server use, coloured the
 * way world.tsx colours the terrain (Belt red rock, Rim crater grey, Helios
 * sand, the Core's violet, snow on the peaks) and hill-shaded from the
 * north-west so ridges, craters and mountains read at a glance. Drawn once,
 * the first time the map opens, then reused.
 */

import { DISTRICTS, groundHeight, SAFE_RADIUS, WORLD_RADIUS } from "@chimp-arena/shared";

const BIOMES: [number, number, number][] = [
  [0x6b, 0x3a, 0x2c], // The Belt
  [0x5d, 0x5a, 0x6c], // Lunar Rim
  [0x6b, 0x56, 0x34], // Helios Docks
];
const CORE: [number, number, number] = [0x3a, 0x30, 0x46];
const SNOW: [number, number, number] = [0xc9, 0xc4, 0xd8];
const DISTRICT_ANGLES = DISTRICTS.map((d) => Math.atan2(d.x, d.z));

/** Pixels across; the world spans `extent` metres either side of the centre. */
const RES = 320;

let cached: { url: string; extent: number } | null = null;

export function mapRelief(extent: number): string {
  if (cached && cached.extent === extent) return cached.url;
  const step = (extent * 2) / RES;
  const heights = new Float32Array((RES + 1) * (RES + 1));
  for (let j = 0; j <= RES; j++)
    for (let i = 0; i <= RES; i++) heights[j * (RES + 1) + i] = groundHeight(-extent + i * step, extent - j * step);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = RES;
  const g = canvas.getContext("2d")!;
  const img = g.createImageData(RES, RES);
  for (let j = 0; j < RES; j++)
    for (let i = 0; i < RES; i++) {
      const x = -extent + (i + 0.5) * step;
      const z = extent - (j + 0.5) * step;
      const o = (j * RES + i) * 4;
      if (Math.hypot(x, z) > WORLD_RADIUS) {
        img.data[o + 3] = 0;
        continue;
      }
      const h = heights[j * (RES + 1) + i];
      // Biome by direction from the Core, fading to violet in the middle (as world.tsx).
      const a = Math.atan2(x, z);
      let r = 0;
      let gr = 0;
      let b = 0;
      let wsum = 0;
      DISTRICT_ANGLES.forEach((da0, k) => {
        const da = Math.atan2(Math.sin(a - da0), Math.cos(a - da0));
        const w = Math.exp(-(da * da) / 0.5);
        r += BIOMES[k][0] * w;
        gr += BIOMES[k][1] * w;
        b += BIOMES[k][2] * w;
        wsum += w;
      });
      r /= wsum;
      gr /= wsum;
      b /= wsum;
      const out = Math.min(1, Math.max(0, (Math.hypot(x, z) - SAFE_RADIUS) / 120));
      r = CORE[0] + (r - CORE[0]) * out;
      gr = CORE[1] + (gr - CORE[1]) * out;
      b = CORE[2] + (b - CORE[2]) * out;
      // Height tint, then hill shading: slope facing the north-west light is lit.
      const tint = 0.85 + Math.max(-0.3, Math.min(0.45, h / 40));
      const east = heights[j * (RES + 1) + i + 1] - h;
      const south = heights[(j + 1) * (RES + 1) + i] - h;
      const shade = Math.max(0.6, Math.min(1.3, 1 - (east + south) * 0.05));
      let k = tint * shade;
      if (h > 45) {
        const s = Math.min(1, (h - 45) / 30);
        r += (SNOW[0] - r) * s;
        gr += (SNOW[1] - gr) * s;
        b += (SNOW[2] - b) * s;
        k = Math.max(k, 0.85);
      }
      // A touch brighter than the 3D ground: the map is read on a dark panel.
      k *= 1.05;
      img.data[o] = Math.min(255, r * k);
      img.data[o + 1] = Math.min(255, gr * k);
      img.data[o + 2] = Math.min(255, b * k);
      img.data[o + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  cached = { url: canvas.toDataURL("image/png"), extent };
  return cached.url;
}
