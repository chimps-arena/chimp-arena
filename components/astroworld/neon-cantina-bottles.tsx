"use client";

/**
 * The Orbital Drift back bar as the Astrochimpz collection: one bottle per
 * character, its label showing the NFT's art, name and tier
 * (public/astroworld/neon-cantina/labels.webp, from scripts/make-bottle-labels.mjs,
 * same order as CHARACTERS).
 *
 *   lower shelf   21 Common     warm spirits, soft glow
 *   upper shelf   21 Rare       luminous cyan / violet / magenta
 *   top cabinet    5 One of One molten gold and void crystal, on lit pucks
 *
 * Coordinates are the Neon Cantina's own space (see neon-cantina.tsx).
 */
import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { CHARACTERS } from "@chimp-arena/shared";

const LABEL_COLS = 8;
const LABEL_ROWS = Math.ceil(CHARACTERS.length / LABEL_COLS);

/** Where each tier stands: board-top height y and usable x span, in the venue's own space. */
export type ShelfLayout = Record<"common" | "rare" | "one_of_one", { y: number; x: readonly [number, number] }>;

/** The Neon Cantina's shelves, measured from its model; the default. */
const NEON_SHELVES: ShelfLayout = {
  common: { y: 1.93, x: [-3.7, 1.8] },
  rare: { y: 2.71, x: [-3.7, 1.8] },
  one_of_one: { y: 3.43, x: [-3.66, -2.54] },
};

/**
 * Bottle silhouettes as [radius, height] lathe profiles (metres, base at 0).
 * `label` = height of the label centre; `r` = body radius there (the label wraps it).
 */
type Shape = { name: string; profile: [number, number][]; label: number; r: number; segments?: number };
const SHAPES: Shape[] = [
  { name: "orbital flask", label: 0.1, r: 0.075, profile: [[0, 0], [0.05, 0], [0.075, 0.03], [0.078, 0.1], [0.07, 0.16], [0.04, 0.2], [0.018, 0.23], [0.016, 0.33], [0.022, 0.34], [0, 0.345]] },
  { name: "rocket", label: 0.14, r: 0.045, profile: [[0, 0], [0.07, 0], [0.07, 0.012], [0.046, 0.04], [0.045, 0.24], [0.03, 0.3], [0.014, 0.34], [0.013, 0.4], [0, 0.41]] },
  { name: "stepped tower", label: 0.09, r: 0.058, profile: [[0, 0], [0.06, 0], [0.06, 0.15], [0.05, 0.16], [0.05, 0.22], [0.038, 0.23], [0.038, 0.27], [0.016, 0.3], [0.015, 0.36], [0, 0.365]] },
  { name: "gourd", label: 0.08, r: 0.066, profile: [[0, 0], [0.04, 0], [0.066, 0.04], [0.068, 0.1], [0.05, 0.15], [0.04, 0.17], [0.05, 0.21], [0.045, 0.25], [0.02, 0.28], [0.017, 0.33], [0, 0.335]] },
  { name: "classic", label: 0.11, r: 0.052, profile: [[0, 0], [0.05, 0], [0.053, 0.01], [0.053, 0.2], [0.044, 0.24], [0.018, 0.28], [0.016, 0.36], [0.019, 0.37], [0, 0.37]] },
];
/** One of One decanters: wide crystal bodies with a ball stopper. */
const DECANTER: Shape = {
  name: "decanter",
  label: 0.1,
  r: 0.08,
  segments: 8,
  profile: [[0, 0], [0.06, 0], [0.085, 0.03], [0.082, 0.17], [0.06, 0.2], [0.024, 0.23], [0.022, 0.27], [0.03, 0.28], [0, 0.28]],
};

/** Liquids per tier: [colour, glow strength]. Values over ~1 bloom. */
const LIQUIDS: Record<string, [string, number][]> = {
  // deep spirits: whiskey, dark rum, gold rum, absinthe, ruby port, cream liqueur
  common: [["#a8520f", 0.22], ["#5a1f08", 0.18], ["#b8860b", 0.25], ["#3f7a12", 0.25], ["#7a0f24", 0.22], ["#c9b48a", 0.12]],
  // luminous rares: ion cyan, nebula violet, plasma magenta, void mint
  rare: [["#0aa6d6", 0.75], ["#6a2bd9", 0.8], ["#d11fa8", 0.75], ["#14c98a", 0.7]],
  // molten gold and void crystal: bright enough to bloom
  one_of_one: [["#ffae00", 1.25], ["#7a2bff", 1.4]],
};
/** Bottles are sized to the shelves: about 0.45 m tall, labels big enough to read from the bar stools. */
const SCALE: Record<string, number> = { common: 1.3, rare: 1.3, one_of_one: 1.2 };
const CAP: Record<string, string> = { common: "#8c6a3a", rare: "#4fe3ff", one_of_one: "#ffc94a" };

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Label geometry: a slice of cylinder on the bottle's front, UVs pointing at this character's cell. */
function labelGeometry(r: number, cell: number) {
  const w = 0.088, h = 0.118;
  const arc = w / r;
  const g = new THREE.CylinderGeometry(r + 0.002, r + 0.002, h, 16, 1, true, -arc / 2, arc);
  const col = cell % LABEL_COLS, row = Math.floor(cell / LABEL_COLS);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (col + uv.getX(i)) / LABEL_COLS, 1 - (row + 1 - uv.getY(i)) / LABEL_ROWS);
  }
  return g;
}

type Placed = { cell: number; tier: string; shape: Shape; x: number; y: number; ry: number; liquid: [string, number] };

function layout(SHELF: ShelfLayout): Placed[] {
  const r = seeded(2175);
  const out: Placed[] = [];
  for (const tier of ["common", "rare", "one_of_one"] as const) {
    const cast = CHARACTERS.map((c, cell) => ({ c, cell })).filter(({ c }) => c.tier === tier);
    const s = SHELF[tier];
    const step = (s.x[1] - s.x[0]) / cast.length;
    cast.forEach(({ cell }, i) => {
      const liquids = LIQUIDS[tier];
      out.push({
        cell,
        tier,
        shape: tier === "one_of_one" ? DECANTER : SHAPES[Math.floor(r() * SHAPES.length)],
        x: s.x[0] + step * (i + 0.5),
        y: s.y + (tier === "one_of_one" ? 0.03 : 0.012),
        ry: (r() - 0.5) * 0.25, // a little turned, like a real back bar; labels still face the room
        liquid: liquids[Math.floor(r() * liquids.length)],
      });
    });
  }
  return out;
}

// Thin, dark-tinted glass: catches highlights without washing the liquid out.
const GLASS = new THREE.MeshStandardMaterial({ color: "#2a2433", roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.22, envMapIntensity: 0.9, depthWrite: false });
const PUCK = (() => {
  const m = new THREE.MeshBasicMaterial({ color: "#ffcf6a", toneMapped: false });
  m.color.multiplyScalar(1.4);
  return m;
})();

/**
 * `rowZ`: depth of the bottle row (just in front of the back wall).
 * `size`: overall scale, for narrower back bars.
 */
export function CollectionBottles({ shelves = NEON_SHELVES, rowZ = -0.5, size = 1 }: { shelves?: ShelfLayout; rowZ?: number; size?: number } = {}) {
  const sheet = useTexture("/astroworld/neon-cantina/labels.webp", (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  });
  const built = useMemo(() => {
    const geos = new Map<Shape, { body: THREE.LatheGeometry; liquid: THREE.LatheGeometry }>();
    const geoFor = (s: Shape) => {
      let g = geos.get(s);
      if (!g) {
        const pts = s.profile.map(([a, b]) => new THREE.Vector2(a, b));
        // liquid: same silhouette, slightly inside the glass, filled to ~65%
        const top = s.profile[s.profile.length - 1][1] * 0.62;
        const inner = s.profile.filter(([, b]) => b <= top).map(([a, b]) => new THREE.Vector2(Math.max(0, a - 0.006), b + 0.004));
        inner.push(new THREE.Vector2(0, top));
        g = { body: new THREE.LatheGeometry(pts, s.segments ?? 22), liquid: new THREE.LatheGeometry(inner, s.segments ?? 22) };
        geos.set(s, g);
      }
      return g;
    };
    const liquidMats = new Map<string, THREE.Material>();
    const liquidMat = ([c, glow]: [string, number]) => {
      const key = c + glow;
      let m = liquidMats.get(key);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: glow, roughness: 0.12, metalness: 0.05 });
        liquidMats.set(key, m);
      }
      return m;
    };
    const capMats = Object.fromEntries(Object.entries(CAP).map(([t, c]) => [t, new THREE.MeshStandardMaterial({ color: c, metalness: 0.9, roughness: 0.3 })]));
    const labelMat = new THREE.MeshStandardMaterial({ map: sheet, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 });
    const items = layout(shelves).map((p) => ({ ...p, geo: geoFor(p.shape), liq: liquidMat(p.liquid), label: labelGeometry(p.shape.r, p.cell) }));
    return { items, geos, liquidMats, capMats, labelMat };
  }, [sheet, shelves]);
  useEffect(
    () => () => {
      built.geos.forEach((g) => { g.body.dispose(); g.liquid.dispose(); });
      built.liquidMats.forEach((m) => m.dispose());
      Object.values(built.capMats).forEach((m) => m.dispose());
      built.labelMat.dispose();
      built.items.forEach((i) => i.label.dispose());
    },
    [built],
  );

  return (
    <group>
      {built.items.map((b) => {
        const top = b.shape.profile[b.shape.profile.length - 1][1];
        return (
          <group key={b.cell} position={[b.x, b.y, rowZ]} rotation={[0, b.ry, 0]} scale={SCALE[b.tier] * size}>
            <mesh geometry={b.geo.liquid} material={b.liq} />
            <mesh geometry={b.geo.body} material={GLASS} renderOrder={1} />
            <mesh position={[0, b.shape.label, 0]} geometry={b.label} material={built.labelMat} />
            {b.tier === "one_of_one" ? (
              <mesh position={[0, top + 0.025, 0]} material={built.capMats[b.tier]}>
                <sphereGeometry args={[0.03, 14, 10]} />
              </mesh>
            ) : (
              <mesh position={[0, top + 0.012, 0]} material={built.capMats[b.tier]}>
                <cylinderGeometry args={[0.02, 0.02, 0.025, 10]} />
              </mesh>
            )}
            {b.tier === "one_of_one" && (
              <mesh position={[0, -0.018, 0]} material={PUCK}>
                <cylinderGeometry args={[0.1, 0.1, 0.02, 24]} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
