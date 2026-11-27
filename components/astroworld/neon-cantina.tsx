"use client";

/**
 * Neon Cantina (core-nc4), "Orbital Drift": the Meshy model built from the
 * property's NFT art, plus every sign, menu, banner, poster and stool name from
 * that art as exact overlays (neon-cantina-signs.ts), plus real lights.
 * Checklist of what must appear: docs/property-details/neon-cantina.md.
 *
 * Coordinates are metres in the building's own space: centred on x/z, base on
 * y=0, front (the bar) facing +z, scaled to WIDTH across.
 */
import { useEffect, useMemo, useState } from "react";
import { Billboard } from "@react-three/drei";
import { HeroModel } from "./hero-model";
import { CollectionBottles } from "./neon-cantina-bottles";
import * as THREE from "three";
import { banner, coldFuelPoster, crownPanel, languagePanel, loadCrown, mainSign, menuBoard, ORBITAL_DRIFT, screen, stoolSkin } from "./neon-cantina-signs";
import { ModelErrorBoundary } from "./model-error-boundary";

export const NEON_CANTINA_URL = "/models/env/neon-cantina.glb";
export const WIDTH = 12;

type Spot = { at: [number, number, number]; size: [number, number]; ry?: number };

/**
 * Where each overlay sits on the model's blank panels. x/y measured from the
 * flat front view (/astroworld/model-preview?ortho=1&signs=0, 50 px = 1 m),
 * z from the model's front-surface depth. Re-measure if the model changes.
 */
export const LAYOUT = {
  main: { at: [-0.04, 5.89, 2.8], size: [5.4, 1.5] } as Spot,
  crown: { at: [-3.61, 5.88, 2.8], size: [1.46, 1.46] } as Spot,
  languages: { at: [3.66, 5.84, 2.8], size: [1.5, 1.66] } as Spot,
  drinks: { at: [-1.54, 4.04, 1.0], size: [1.72, 1.24] } as Spot,
  food: { at: [0.49, 4.04, 1.0], size: [1.96, 1.24] } as Spot,
  screens: [
    { at: [2.6, 3.11, -0.05], size: [0.46, 0.78] },
    { at: [3.16, 3.11, -0.05], size: [0.58, 0.78] },
  ] as Spot[],
  banner: { at: [5.51, 5.91, 3.8], size: [0.7, 3.5] } as Spot,
  poster: { at: [-5.14, 4.34, 2.85], size: [0.6, 1.2] } as Spot,
  /** Barrel stools, left to right: Austin, Smile, zee, Omah, davvycole; evenly spaced along the bar. */
  stools: { xs: [-3.2, -1.6, 0, 1.6, 3.2], front: 4.3, radius: 0.36 },
};

const frameMat = new THREE.MeshStandardMaterial({ color: "#2b2730", metalness: 0.8, roughness: 0.45 });
const rimMat = new THREE.MeshStandardMaterial({ color: "#9b97a0", metalness: 0.9, roughness: 0.35 });
const seatMat = new THREE.MeshStandardMaterial({ color: "#8d8992", metalness: 0.85, roughness: 0.4 });

/**
 * A barrel stool as in the art: dented silver drum with two ribs, sitting on a
 * dark metal ring with four splayed legs; the crew member's name on the front.
 * Replaces Meshy's lumpy stools (cut out of the model by scripts/cut-stools).
 */
function BarrelStool({ x, skin }: { x: number; skin: THREE.Texture }) {
  const { front, radius } = LAYOUT.stools;
  const drumH = 0.7, legH = 0.36;
  const z = front - radius;
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ map: skin, metalness: 0.75, roughness: 0.42 }), [skin]);
  useEffect(() => () => skinMat.dispose(), [skinMat]);
  return (
    <group position={[x, 0.04, z]}>
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * radius * 0.78, legH / 2, Math.cos(a) * radius * 0.78]} rotation={[Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12]} material={frameMat}>
            <cylinderGeometry args={[0.03, 0.035, legH, 8]} />
          </mesh>
        );
      })}
      <mesh position={[0, legH * 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} material={frameMat}>
        <torusGeometry args={[radius * 0.8, 0.025, 8, 32]} />
      </mesh>
      <mesh position={[0, legH + drumH / 2, 0]} material={skinMat}>
        {/* thetaStart -PI puts the middle of the texture (the name) at the front, +z. */}
        <cylinderGeometry args={[radius, radius * 0.96, drumH, 40, 1, false, -Math.PI, Math.PI * 2]} />
      </mesh>
      {/* Ribs near the rims, as in the art, leaving the middle clear for the name. */}
      {[0.1, 0.9].map((t) => (
        <mesh key={t} position={[0, legH + drumH * t, 0]} rotation={[Math.PI / 2, 0, 0]} material={rimMat}>
          <torusGeometry args={[radius + 0.006, 0.018, 8, 40]} />
        </mesh>
      ))}
      <mesh position={[0, legH + drumH + 0.015, 0]} material={seatMat}>
        <cylinderGeometry args={[radius * 1.01, radius * 1.01, 0.03, 40]} />
      </mesh>
    </group>
  );
}

function Model() {
  return <HeroModel url={NEON_CANTINA_URL} width={WIDTH} />;
}

/* --------------------------- wet floor + haze --------------------------- */

/** Terrace in front of the bar, on the model's platform (measured: y 0.03, front edge z 5.35). */
const FLOOR = { x: [-5.9, 5.9] as const, z: [2.95, 5.35] as const, y: 0.036 };

/** Dark wet tiles with grout lines and puddle patches. */
export function wetTiles() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  const r = seeded(5);
  g.fillStyle = "#0c0a10";
  g.fillRect(0, 0, c.width, c.height);
  const tile = 64;
  for (let y = 0; y < c.height; y += tile)
    for (let x = 0; x < c.width; x += tile) {
      const v = 14 + Math.floor(r() * 10);
      g.fillStyle = `rgb(${v},${v - 2},${v + 4})`;
      g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  for (let i = 0; i < 18; i++) {
    const x = r() * c.width, y = r() * c.height, s = 30 + r() * 90;
    const p = g.createRadialGradient(x, y, 0, x, y, s);
    p.addColorStop(0, "rgba(4,3,6,0.7)");
    p.addColorStop(1, "rgba(4,3,6,0)");
    g.fillStyle = p;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * The neon's reflection on the wet floor: soft vertical streaks under each
 * light source, brightest at the bar and fading toward the viewer, with ripple.
 * Canvas top = the bar side (the plane is laid flat, +v pointing to -z).
 */
function neonReflections() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  const r = seeded(11);
  const W = FLOOR.x[1] - FLOOR.x[0];
  const u = (x: number) => ((x - FLOOR.x[0]) / W) * c.width;
  const streak = (x0: number, x1: number, rgb: string, a: number, reach = 1) => {
    for (let x = u(x0); x < u(x1); x += 2) {
      const jitter = 0.55 + r() * 0.45;
      const grad = g.createLinearGradient(0, 0, 0, c.height * reach);
      grad.addColorStop(0, `rgba(${rgb},${a * jitter})`);
      grad.addColorStop(0.35, `rgba(${rgb},${a * jitter * 0.45})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(x, 0, 2, c.height * reach);
    }
  };
  g.globalCompositeOperation = "lighter";
  streak(-3.9, 3.5, "255,63,210", 0.5, 0.45); // bar LED strip, close and strong
  streak(-2.7, 2.7, "255,79,216", 0.32); // ORBITAL DRIFT
  streak(-4.3, -2.9, "215,205,255", 0.24); // crown panel
  streak(2.9, 4.4, "255,79,216", 0.22); // language panel
  streak(-4.3, -3.0, "63,220,255", 0.2, 0.8);
  streak(1.36, 2.76, "63,220,255", 0.18, 0.8);
  streak(-3.75, 1.85, "255,170,80", 0.14, 0.6); // shelf glow through the bar
  // ripples: thin dark bands breaking the streaks, like puddle edges
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.35})`;
    g.fillRect(r() * c.width, r() * c.height, 30 + r() * 160, 1 + r() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function WetFloor() {
  const [tiles, glow] = useMemo(() => [wetTiles(), neonReflections()], []);
  useEffect(() => () => { tiles.dispose(); glow.dispose(); }, [tiles, glow]);
  const w = FLOOR.x[1] - FLOOR.x[0], d = FLOOR.z[1] - FLOOR.z[0];
  const at: [number, number, number] = [(FLOOR.x[0] + FLOOR.x[1]) / 2, FLOOR.y, (FLOOR.z[0] + FLOOR.z[1]) / 2];
  return (
    <group>
      <mesh position={at} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tiles} roughness={0.12} metalness={0.3} envMapIntensity={0.5} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[at[0], at[1] + 0.002, at[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial map={glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  );
}

/** A soft glow sprite for haze; additive, kept below the bloom threshold. */
function hazeSprite(rgb: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const p = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  p.addColorStop(0, `rgba(${rgb},0.55)`);
  p.addColorStop(0.5, `rgba(${rgb},0.18)`);
  p.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = p;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Light haze hanging in the bar and under the sign, as in the art's air. */
function Haze() {
  const [pink, amber] = useMemo(() => [hazeSprite("255,90,220"), hazeSprite("255,170,90")], []);
  useEffect(() => () => { pink.dispose(); amber.dispose(); }, [pink, amber]);
  const puffs: { at: [number, number, number]; s: [number, number]; map: THREE.Texture; o: number }[] = [
    { at: [0, 6.0, 3.4], s: [10, 3.2], map: pink, o: 0.22 },
    { at: [-0.8, 3.2, 1.0], s: [7.5, 2.6], map: amber, o: 0.2 },
    { at: [0, 1.2, 3.8], s: [9, 1.8], map: pink, o: 0.14 },
  ];
  return (
    <group>
      {puffs.map((p, i) => (
        <Billboard key={i} position={p.at}>
          <mesh renderOrder={4}>
            <planeGeometry args={p.s} />
            <meshBasicMaterial map={p.map} transparent opacity={p.o} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}

/**
 * Light sources are drawn brighter than white so the Bloom pass makes them
 * glow (its threshold is 1.0); everything else stays below and stays crisp.
 */
const GLOW = 1.35;
const neon = (hex: string, k = 1.8) => {
  const m = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });
  m.color.multiplyScalar(k);
  return m;
};
const PINK_TUBE = neon("#ff3fd2");
const CYAN_TUBE = neon("#3fdcff");

/**
 * Neon tubes on the facade, measured from the flat front view
 * (x from..to, y, colour). They sit just proud of the front plane (z 2.95).
 */
const TUBES: { x: [number, number]; y: number; z?: number; c: "p" | "c" }[] = [
  // row along the top of the sign band
  { x: [-4.3, -2.85], y: 6.8, c: "p" },
  { x: [-2.6, -0.4], y: 6.8, c: "p" },
  { x: [-0.1, 1.0], y: 6.8, c: "p" },
  { x: [1.1, 2.3], y: 6.8, c: "p" },
  { x: [2.95, 4.55], y: 6.8, c: "c" },
  // broken cyan row above it
  { x: [-1.2, -0.25], y: 7.24, c: "c" },
  { x: [0.05, 0.85], y: 7.24, c: "c" },
  { x: [1.45, 2.15], y: 7.24, c: "c" },
  { x: [3.65, 4.25], y: 7.24, c: "c" },
  // row under the signs
  { x: [-4.28, -3.04], y: 5.04, c: "c" },
  { x: [-2.54, -1.24], y: 5.04, c: "p" },
  { x: [-0.84, 0.56], y: 5.04, c: "p" },
  { x: [1.36, 2.76], y: 5.04, c: "c" },
  { x: [3.06, 4.36], y: 5.04, c: "p" },
];
/** Vertical tubes on the pillars: x, y from..to. */
const POSTS: { x: number; y: [number, number]; z: number; c: "p" | "c" }[] = [
  { x: 4.06, y: [2.64, 4.04], z: 2.58, c: "p" },
  { x: -4.62, y: [2.4, 4.2], z: 2.66, c: "p" },
];

function NeonTubes() {
  return (
    <group>
      {TUBES.map((t, i) => (
        <mesh key={i} position={[(t.x[0] + t.x[1]) / 2, t.y, t.z ?? 2.95]} rotation={[0, 0, Math.PI / 2]} material={t.c === "p" ? PINK_TUBE : CYAN_TUBE}>
          <capsuleGeometry args={[0.035, t.x[1] - t.x[0], 4, 8]} />
        </mesh>
      ))}
      {POSTS.map((p, i) => (
        <mesh key={i} position={[p.x, (p.y[0] + p.y[1]) / 2, p.z]} material={p.c === "p" ? PINK_TUBE : CYAN_TUBE}>
          <capsuleGeometry args={[0.035, p.y[1] - p.y[0], 4, 8]} />
        </mesh>
      ))}
      {/* the pink LED strip along the bar counter's edge */}
      <mesh position={[-0.2, 1.44, 2.95]} rotation={[0, 0, Math.PI / 2]} material={PINK_TUBE}>
        <capsuleGeometry args={[0.025, 7.4, 4, 8]} />
      </mesh>
    </group>
  );
}

/* ------------------------------ back bar ------------------------------ */

/**
 * Shelves measured from the flat front view: board height y, x span. Meshy's
 * shard-like bottles are cut out of the model (scripts/cut-boxes/neon-cantina.json)
 * and replaced by these.
 */
const SHELVES: { y: number; x: [number, number] }[] = [
  { y: 2.71, x: [-3.75, 1.85] },
  { y: 1.93, x: [-3.75, 1.85] },
  { y: 3.43, x: [-3.7, -2.5] },
];
const SHELF_BACK = -0.74; // just in front of the back wall (z -0.8)

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Back bar: the Astrochimpz collection bottles (neon-cantina-bottles.tsx) plus shelf light. */
function Bottles() {
  const glow = useMemo(() => shelfGlowMat(), []);
  return (
    <group>
      <ModelErrorBoundary fallback={null} what="Neon Cantina bottle labels">
        <CollectionBottles />
      </ModelErrorBoundary>
      {/* Warm backlight behind each shelf, as in the art; bright enough to glow. */}
      {SHELVES.map((s, i) => (
        <mesh key={i} position={[(s.x[0] + s.x[1]) / 2, s.y + 0.24, SHELF_BACK]} material={glow}>
          <planeGeometry args={[s.x[1] - s.x[0], 0.46]} />
        </mesh>
      ))}
      {/* amber LED strip along each shelf's front edge */}
      {SHELVES.map((s, i) => (
        <mesh key={i} position={[(s.x[0] + s.x[1]) / 2, s.y - 0.01, SHELF_BACK + 0.5]} rotation={[0, 0, Math.PI / 2]} material={AMBER_TUBE}>
          <capsuleGeometry args={[0.012, s.x[1] - s.x[0], 4, 6]} />
        </mesh>
      ))}
    </group>
  );
}
/**
 * Shelf backlight: warm amber, brightest just above the shelf board and fading
 * upward with soft pools under each hidden light, as in the art (not a flat panel).
 * Built lazily (needs a canvas, so client only).
 */
let shelfGlow: THREE.MeshBasicMaterial | null = null;
function shelfGlowMat() {
  if (shelfGlow) return shelfGlow;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  const v = g.createLinearGradient(0, c.height, 0, 0);
  v.addColorStop(0, "rgba(255,150,60,0.95)");
  v.addColorStop(0.45, "rgba(214,104,40,0.55)");
  v.addColorStop(1, "rgba(90,40,30,0.05)");
  g.fillStyle = v;
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (c.width / 6);
    const pool = g.createRadialGradient(x, c.height, 4, x, c.height, 70);
    pool.addColorStop(0, "rgba(255,214,150,0.55)");
    pool.addColorStop(1, "rgba(255,214,150,0)");
    g.fillStyle = pool;
    g.fillRect(x - 70, 0, 140, c.height);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  shelfGlow = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, transparent: true, depthWrite: false });
  shelfGlow.color.setScalar(1.12); // the warm bottom edge crosses the glow threshold, the top does not
  return shelfGlow;
}
const AMBER_TUBE = neon("#ffb04a", 1.6);

/* ------------------------------- bar top ------------------------------- */

const BAR_TOP = 1.75; // top of the glossy counter slab (measured counter surface 1.70 + slab)
const TUMBLER = new THREE.MeshStandardMaterial({ color: "#e8dcef", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, envMapIntensity: 2 });
const DRINK = new THREE.MeshStandardMaterial({ color: "#c46a1c", roughness: 0.2, transparent: true, opacity: 0.85, emissive: "#5a2408", emissiveIntensity: 0.6 });
const CANDLE_GLASS = { p: neon("#ff4fd8", 1.25), a: neon("#ffb04a", 1.35) };
const FLAME = neon("#ffe2a8", 2.4);
// Dark lacquer. Low specular so grazing views do not mirror the purple sky lights (that read as lavender plastic).
const COUNTER = new THREE.MeshPhysicalMaterial({ color: "#0b080d", metalness: 0, roughness: 0.3, specularIntensity: 0.25, envMapIntensity: 0.15 });

/** Glasses and candle glasses along the bar, spaced like the art (in front of each seat, candles between). */
function BarTop() {
  const items = useMemo(() => {
    const r = seeded(9);
    const out: { kind: "glass" | "candle"; x: number; z: number; tint: "p" | "a" }[] = [];
    for (const x of LAYOUT.stools.xs) {
      out.push({ kind: "glass", x: x - 0.12 + r() * 0.08, z: 2.45 + r() * 0.15, tint: "a" });
      if (r() < 0.6) out.push({ kind: "glass", x: x + 0.18 + r() * 0.06, z: 2.3 + r() * 0.1, tint: "a" });
    }
    for (const x of [-3.7, -2.4, -0.8, 0.8, 2.4, 3.5]) out.push({ kind: "candle", x, z: 2.55, tint: r() < 0.5 ? "p" : "a" });
    return out;
  }, []);
  return (
    <group>
      {/* Glossy dark counter slab over Meshy's crumpled top: reflects the neon like the art. */}
      <mesh position={[-0.1, BAR_TOP - 0.06, 2.3]} material={COUNTER}>
        <boxGeometry args={[7.7, 0.12, 1.55]} />
      </mesh>
      {items.map((it, i) =>
        it.kind === "glass" ? (
          <group key={i} position={[it.x, BAR_TOP, it.z]} scale={1.6}>
            <mesh position={[0, 0.05, 0]} material={TUMBLER}>
              <cylinderGeometry args={[0.038, 0.034, 0.1, 14, 1, true]} />
            </mesh>
            <mesh position={[0, 0.03, 0]} material={DRINK}>
              <cylinderGeometry args={[0.034, 0.032, 0.055, 14]} />
            </mesh>
          </group>
        ) : (
          <group key={i} position={[it.x, BAR_TOP, it.z]} scale={1.6}>
            <mesh position={[0, 0.045, 0]} material={CANDLE_GLASS[it.tint]}>
              <cylinderGeometry args={[0.042, 0.042, 0.09, 14, 1, true]} />
            </mesh>
            <mesh position={[0, 0.07, 0]} material={FLAME}>
              <sphereGeometry args={[0.014, 8, 6]} />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

/* ---------------------------- pendant lamps ---------------------------- */

/** Hood positions measured from the flat front view (x, y of the hood's lower rim). */
const LAMPS: [number, number][] = [[-3.58, 4.3], [-0.62, 4.35], [1.76, 4.25], [3.22, 4.2]]; // 2nd sits in the gap between the menus
const LAMP_Z = 1.0;
const BULB = neon("#ffd59a", 2.2);
const HOOD = new THREE.MeshStandardMaterial({ color: "#3a3036", metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide });
const HOOD_IN = (() => {
  const m = new THREE.MeshBasicMaterial({ color: "#ffbf73", toneMapped: false, side: THREE.BackSide });
  m.color.multiplyScalar(1.3);
  return m;
})();

function PendantLamps() {
  return (
    <group>
      {LAMPS.map(([x, y], i) => (
        <group key={i} position={[x, y, LAMP_Z]}>
          <mesh position={[0, 0.5, 0]} material={HOOD}>
            <cylinderGeometry args={[0.008, 0.008, 0.8, 6]} />
          </mesh>
          {/* dome: dark outside, glowing warm inside */}
          <mesh position={[0, 0.06, 0]} material={HOOD}>
            <cylinderGeometry args={[0.05, 0.2, 0.16, 20, 1, true]} />
          </mesh>
          <mesh position={[0, 0.06, 0]} material={HOOD_IN}>
            <cylinderGeometry args={[0.048, 0.198, 0.158, 20, 1, true]} />
          </mesh>
          <mesh position={[0, -0.01, 0]} material={BULB}>
            <sphereGeometry args={[0.055, 14, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Overlay({ spot, map, glow = true }: { spot: Spot; map: THREE.Texture | null; glow?: boolean }) {
  if (!map) return null;
  return (
    <mesh position={spot.at} rotation={[0, spot.ry ?? 0, 0]} renderOrder={2}>
      <planeGeometry args={spot.size} />
      {glow ? (
        <meshBasicMaterial map={map} color={[GLOW, GLOW, GLOW]} toneMapped={false} transparent polygonOffset polygonOffsetFactor={-2} />
      ) : (
        <meshStandardMaterial map={map} transparent roughness={0.85} polygonOffset polygonOffsetFactor={-2} />
      )}
    </mesh>
  );
}

type Maps = Record<"main" | "crown" | "languages" | "drinks" | "food" | "banner" | "poster" | "screen", THREE.Texture> & { stools: THREE.Texture[] };

/** Signs need the crown image and the site fonts loaded before drawing. */
function useSigns() {
  const [maps, setMaps] = useState<Maps | null>(null);
  useEffect(() => {
    let live = true;
    let made: Maps | null = null;
    Promise.all([loadCrown(), document.fonts.ready]).then(([crown]) => {
      if (!live) return;
      made = {
        main: mainSign(),
        crown: crownPanel(crown),
        languages: languagePanel(),
        drinks: menuBoard("drinks"),
        food: menuBoard("food"),
        banner: banner(crown),
        poster: coldFuelPoster(crown),
        screen: screen(crown),
        stools: ORBITAL_DRIFT.stools.map((n, i) => stoolSkin(n, 7 + i * 13)),
      };
      setMaps(made);
    });
    return () => {
      live = false;
      if (made) [...Object.values(made).filter((t): t is THREE.Texture => t instanceof THREE.Texture), ...made.stools].forEach((t) => t.dispose());
    };
  }, []);
  return maps;
}

export function NeonCantina({ signs = true }: { signs?: boolean }) {
  const loaded = useSigns();
  const m = signs ? loaded : null;
  return (
    <group>
      <Model />
      <NeonTubes />
      <Bottles />
      <BarTop />
      <PendantLamps />
      <WetFloor />
      <Haze />
      {m && (
        <>
          <Overlay spot={LAYOUT.main} map={m.main} />
          <Overlay spot={LAYOUT.crown} map={m.crown} />
          <Overlay spot={LAYOUT.languages} map={m.languages} />
          <Overlay spot={LAYOUT.drinks} map={m.drinks} />
          <Overlay spot={LAYOUT.food} map={m.food} />
          {LAYOUT.screens.map((s, i) => <Overlay key={i} spot={s} map={m.screen} />)}
          <Overlay spot={LAYOUT.banner} map={m.banner} glow={false} />
          <Overlay spot={LAYOUT.poster} map={m.poster} glow={false} />
          {LAYOUT.stools.xs.map((x, i) => <BarrelStool key={i} x={x} skin={m.stools[i]} />)}
        </>
      )}
      {/*
        Only two real lights: every point light costs on every lit surface in the
        whole world, not just here. Amber pools under the pendants onto the bar;
        pink spills out over the stools and terrace. Glow does the rest.
      */}
      <pointLight position={[-0.3, 3.9, 1.3]} color="#ffb060" intensity={24} distance={7} decay={2} />
      <pointLight position={[0, 3.2, 5.2]} color={"#ff4fd8"} intensity={22} distance={6} />
    </group>
  );
}
