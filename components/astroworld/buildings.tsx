"use client";

/**
 * Property-market properties as buildings. Each property type gets its own
 * architecture (a mining claim is a drill rig, a greenhouse is a glass dome,
 * a hangar is an arched hall...), the property's own NFT art on a lit
 * billboard out front, and a sign with its name and owner - or its price if
 * it's for sale. Art and signs only load near the player, to keep 100+
 * buildings cheap.
 */

import { memo, Suspense, useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Placement } from "@chimp-arena/shared";
import { ItemPedestal, productFor } from "./items";
import { EnvModel, type EnvId, type Fit } from "./env-models";

export interface WorldProperty {
  id: string;
  name: string;
  zone: string;
  type: string;
  priceChimp: number;
  image: string | null;
  ownerHandle: string | null;
  forSale: boolean;
}

/* ------------------------------ materials ------------------------------ */

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  dome: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  halfCyl: new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI),
  cone: new THREE.ConeGeometry(1, 1, 16),
  plane: new THREE.PlaneGeometry(1, 1),
};

const M = {
  hull: new THREE.MeshStandardMaterial({ color: "#4a4562", metalness: 0.55, roughness: 0.32 }),
  hullLight: new THREE.MeshStandardMaterial({ color: "#7a748f", metalness: 0.45, roughness: 0.38 }),
  concrete: new THREE.MeshStandardMaterial({ color: "#6a6474", metalness: 0.1, roughness: 0.8 }),
  rust: new THREE.MeshStandardMaterial({ color: "#8a4a2a", metalness: 0.4, roughness: 0.65 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#a5e8ff", transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2, depthWrite: false }),
  solar: new THREE.MeshStandardMaterial({ color: "#14204a", metalness: 0.9, roughness: 0.2, emissive: "#0a1a5a", emissiveIntensity: 0.3 }),
  plant: new THREE.MeshStandardMaterial({ color: "#2f8a3f", roughness: 0.8 }),
  rock: new THREE.MeshStandardMaterial({ color: "#4a3a30", roughness: 0.95, flatShading: true }),
  frame: new THREE.MeshStandardMaterial({ color: "#2a2638", metalness: 0.6, roughness: 0.3 }),
  dark: new THREE.MeshBasicMaterial({ color: "#05040a" }),
};

const neon = new Map<string, THREE.MeshBasicMaterial>();
function glow(color: string) {
  let m = neon.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    neon.set(color, m);
  }
  return m;
}

function B({
  g = G.box,
  m,
  p,
  s,
  r = [0, 0, 0],
}: {
  g?: THREE.BufferGeometry;
  m: THREE.Material;
  p: [number, number, number];
  s: [number, number, number];
  r?: [number, number, number];
}) {
  return <mesh geometry={g} material={m} position={p} scale={s} rotation={r} />;
}

/* ------------------------------ archetypes ------------------------------ */

type Arch = (a: string) => React.ReactNode;

const tower: Arch = (a) => (
  <>
    <B g={G.cyl6} m={M.hull} p={[0, 11, 0]} s={[3.6, 22, 3.6]} />
    <B g={G.cyl6} m={glow(a)} p={[0, 22.3, 0]} s={[3.7, 0.4, 3.7]} />
    <B g={G.cyl6} m={glow(a)} p={[0, 8, 0]} s={[3.7, 0.25, 3.7]} />
    <B g={G.cyl} m={M.hullLight} p={[0, 24, 0]} s={[0.15, 4, 0.15]} />
    <B g={G.box} m={M.hull} p={[0, 2.5, 3.4]} s={[4, 5, 1.5]} />
  </>
);

const beacon: Arch = (a) => (
  <>
    <B g={G.cyl} m={M.hull} p={[0, 7, 0]} s={[1.2, 14, 1.2]} />
    <B g={G.box} m={M.hull} p={[0, 1.5, 0]} s={[6, 3, 6]} />
    <mesh geometry={G.cone} material={glow(a)} position={[0, 15.5, 0]} scale={[1.6, 3, 1.6]} />
    <pointLight position={[0, 15, 0]} color={a} intensity={40} distance={30} />
  </>
);

const observatory: Arch = (a) => (
  <>
    <B g={G.cyl} m={M.hull} p={[0, 3, 0]} s={[5, 6, 5]} />
    <B g={G.dome} m={M.hullLight} p={[0, 6, 0]} s={[5, 5, 5]} />
    <B g={G.box} m={M.dark} p={[0, 9, 2]} s={[1.4, 3, 3]} r={[-0.5, 0, 0]} />
    <B g={G.cyl} m={M.frame} p={[0, 10, 1.5]} s={[0.5, 6, 0.5]} r={[-0.9, 0, 0]} />
    <B g={G.cyl} m={glow(a)} p={[0, 6, 0]} s={[5.05, 0.25, 5.05]} />
  </>
);

const dome: Arch = (a) => (
  <>
    <B g={G.cyl} m={M.hull} p={[0, 0.6, 0]} s={[6, 1.2, 6]} />
    <B g={G.dome} m={M.glass} p={[0, 1.2, 0]} s={[5.8, 5.2, 5.8]} />
    <B g={G.cyl} m={glow(a)} p={[0, 1.25, 0]} s={[6.05, 0.15, 6.05]} />
    <B m={M.hullLight} p={[0, 2, 0]} s={[3, 2, 3]} />
  </>
);

const greenhouse: Arch = (a) => (
  <>
    <B g={G.cyl} m={M.hull} p={[0, 0.5, 0]} s={[6, 1, 6]} />
    <B g={G.dome} m={M.glass} p={[0, 1, 0]} s={[5.8, 5.5, 5.8]} />
    {[-2.5, 0, 2.5].map((x) =>
      [-2, 1.5].map((z) => <B key={`${x}${z}`} g={G.cone} m={M.plant} p={[x, 2.5, z]} s={[0.9, 2.4, 0.9]} />),
    )}
    <B g={G.cyl} m={glow(a)} p={[0, 1.05, 0]} s={[6.05, 0.12, 6.05]} />
  </>
);

const lab: Arch = (a) => (
  <>
    <B m={M.hullLight} p={[0, 3, 0]} s={[10, 6, 8]} />
    <B g={G.dome} m={M.glass} p={[-2, 6, 0]} s={[2.6, 2.4, 2.6]} />
    <B g={G.cyl} m={M.hull} p={[3, 7.5, 1]} s={[0.6, 3, 0.6]} />
    <B m={glow(a)} p={[0, 5.4, 4.02]} s={[10, 0.25, 0.05]} />
  </>
);

const hangar: Arch = (a) => (
  <>
    <B g={G.halfCyl} m={M.hull} p={[0, 0, 0]} s={[6.5, 13, 6.5]} r={[Math.PI / 2, 0, Math.PI / 2]} />
    <B m={M.dark} p={[0, 2.6, 6.45]} s={[7, 5.2, 0.1]} />
    <B m={glow(a)} p={[0, 5.4, 6.5]} s={[7.4, 0.25, 0.05]} />
  </>
);

const dock: Arch = (a) => (
  <>
    <B m={M.concrete} p={[0, 0.5, 0]} s={[12, 1, 10]} />
    <B m={M.hull} p={[-4, 6, -3]} s={[0.8, 12, 0.8]} />
    <B m={M.hull} p={[-1, 11.6, -3]} s={[7, 0.7, 0.7]} />
    <B m={M.hullLight} p={[2, 8, -3]} s={[0.1, 7, 0.1]} />
    <B m={M.rust} p={[2, 4, -3]} s={[3, 1.6, 2]} />
    <B m={M.hull} p={[3, 2, 2]} s={[4, 2, 3]} />
    <B m={glow(a)} p={[0, 1.02, 5]} s={[12, 0.05, 0.25]} />
  </>
);

const industrial =
  (stacks: number): Arch =>
  // eslint-disable-next-line react/display-name -- an architecture recipe, not a component
  (a) => (
    <>
      <B m={M.concrete} p={[0, 3.5, 0]} s={[11, 7, 9]} />
      {Array.from({ length: stacks }, (_, i) => (
        <B key={i} g={G.cyl} m={M.rust} p={[-3 + i * 3, 9, -2]} s={[0.8, 7, 0.8]} />
      ))}
      <B m={glow("#ff7a2a")} p={[0, 2, 4.52]} s={[6, 1.2, 0.05]} />
      <B m={glow(a)} p={[0, 6.6, 4.52]} s={[11, 0.2, 0.05]} />
    </>
  );

const miningClaim: Arch = (a) => (
  <>
    <B m={M.concrete} p={[0, 0.3, 0]} s={[10, 0.6, 10]} />
    {[-1, 1].map((x) =>
      [-1, 1].map((z) => <B key={`${x}${z}`} m={M.hull} p={[x * 2.2, 6, z * 2.2]} s={[0.4, 12, 0.4]} r={[z * 0.12, 0, -x * 0.12]} />),
    )}
    <B g={G.cyl} m={M.rust} p={[0, 5, 0]} s={[0.6, 10, 0.6]} />
    <B g={G.cone} m={glow(a)} p={[0, 0.8, 0]} s={[1, 1.2, 1]} r={[Math.PI, 0, 0]} />
    <B m={M.hullLight} p={[3.5, 1.5, 3]} s={[2.5, 2.4, 2.5]} />
    <B g={G.dome} m={M.rock} p={[-3.5, 0.3, 3]} s={[1.8, 1.4, 1.8]} />
  </>
);

const quarry: Arch = (a) => (
  <>
    <B g={G.cyl} m={M.rock} p={[0, 0.2, 0]} s={[6, 0.4, 6]} />
    <B g={G.cyl} m={M.dark} p={[0, 0.25, 0]} s={[4, 0.4, 4]} />
    {[0, 1, 2, 3, 4].map((i) => (
      <B key={i} g={G.dome} m={M.rock} p={[Math.sin(i * 1.3) * 5.2, 0, Math.cos(i * 1.3) * 5.2]} s={[1.6, 1.4 + (i % 2), 1.6]} />
    ))}
    <B m={M.hull} p={[4, 4, -4]} s={[0.5, 8, 0.5]} />
    <B m={glow(a)} p={[4, 8.2, -4]} s={[0.8, 0.3, 0.8]} />
  </>
);

const bunker: Arch = (a) => (
  <>
    <B m={M.concrete} p={[0, 1.8, 0]} s={[11, 3.6, 9]} />
    <B m={M.concrete} p={[0, 3.9, 0]} s={[9, 0.6, 7]} />
    <B m={M.dark} p={[0, 2.6, 4.52]} s={[7, 0.35, 0.05]} />
    <B m={M.hull} p={[0, 1.2, 4.52]} s={[3, 2.4, 0.1]} />
    <B m={glow(a)} p={[0, 2.5, 4.56]} s={[3.2, 0.1, 0.02]} />
  </>
);

const vault: Arch = (a) => (
  <>
    <B m={M.hull} p={[0, 4, 0]} s={[10, 8, 9]} />
    <B g={G.cyl} m={M.hullLight} p={[0, 3.5, 4.55]} s={[2.6, 0.3, 2.6]} r={[Math.PI / 2, 0, 0]} />
    <B g={G.cyl} m={glow(a)} p={[0, 3.5, 4.72]} s={[0.5, 0.1, 0.5]} r={[Math.PI / 2, 0, 0]} />
    <B m={glow(a)} p={[0, 7.8, 4.52]} s={[10, 0.2, 0.05]} />
  </>
);

const armory: Arch = (a) => (
  <>
    <B m={M.hull} p={[0, 3.5, 0]} s={[11, 7, 9]} />
    <B m={M.dark} p={[0, 2.2, 4.52]} s={[6, 4.4, 0.05]} />
    <B m={glow("#a855f7")} p={[0, 4.6, 4.55]} s={[6.4, 0.2, 0.05]} />
    {[-4, 4].map((x) => (
      <B key={x} m={M.hullLight} p={[x, 1, 5.5]} s={[1.6, 2, 1.6]} />
    ))}
    <B m={glow(a)} p={[0, 6.8, 4.52]} s={[11, 0.2, 0.05]} />
  </>
);

const storefront =
  (height: number, awning: string): Arch =>
  // eslint-disable-next-line react/display-name -- an architecture recipe, not a component
  (a) => (
    <>
      <B m={M.hullLight} p={[0, height / 2, 0]} s={[10, height, 8]} />
      <B m={M.glass} p={[0, 1.8, 4.05]} s={[8, 3.2, 0.05]} />
      <B m={glow(awning)} p={[0, 3.7, 4.6]} s={[9, 0.15, 1.2]} />
      <B m={glow(a)} p={[0, height - 0.2, 4.02]} s={[10, 0.25, 0.05]} />
    </>
  );

const loft: Arch = (a) => (
  <>
    <B m={M.hullLight} p={[0, 4.5, 0]} s={[9, 9, 8]} />
    {[2.5, 6].map((y) => [-2.5, 2.5].map((x) => <B key={`${x}${y}`} m={glow("#f5d27a")} p={[x, y, 4.02]} s={[2.2, 1.4, 0.05]} />))}
    <B m={M.hull} p={[0, 9.2, 0]} s={[9.5, 0.4, 8.5]} />
    <B m={glow(a)} p={[0, 0.6, 4.02]} s={[9, 0.15, 0.05]} />
  </>
);

const yard: Arch = (a) => (
  <>
    <B m={M.concrete} p={[0, 0.15, 0]} s={[12, 0.3, 11]} />
    {[
      [-3, 0.9, -3, "#7a2a2a"],
      [0, 0.9, -3, "#2a4a7a"],
      [3, 0.9, -3, "#7a6a2a"],
      [-1.5, 2.6, -3, "#2a7a4a"],
    ].map(([x, y, z, c]) => (
      <B key={`${x}${y}`} m={new THREE.MeshStandardMaterial({ color: c as string, metalness: 0.5, roughness: 0.6 })} p={[x as number, y as number, z as number]} s={[2.8, 1.6, 2.2]} />
    ))}
    <B m={M.hull} p={[4.5, 3, 2]} s={[0.4, 6, 0.4]} />
    <B m={glow(a)} p={[0, 0.32, 5.4]} s={[12, 0.05, 0.2]} />
  </>
);

const scrapheap: Arch = (a) => (
  <>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <B key={i} m={i % 2 ? M.rust : M.hull} p={[Math.sin(i * 2.1) * 3, 0.8 + (i % 3) * 0.9, Math.cos(i * 2.1) * 3]} s={[2.5, 1.6, 2]} r={[i * 0.3, i, i * 0.2]} />
    ))}
    <B m={M.hull} p={[3.5, 4, -3]} s={[0.4, 8, 0.4]} />
    <B m={glow(a)} p={[3.5, 8.2, -3]} s={[0.7, 0.3, 0.7]} />
  </>
);

const array: Arch = (a) => (
  <>
    {[-3.5, 0, 3.5].map((z) =>
      [-3, 3].map((x) => (
        <group key={`${x}${z}`} position={[x, 1.6, z]}>
          <B m={M.hull} p={[0, -0.8, 0]} s={[0.2, 1.6, 0.2]} />
          <B m={M.solar} p={[0, 0, 0]} s={[5, 0.1, 2.8]} r={[0.45, 0, 0]} />
        </group>
      )),
    )}
    <B m={glow(a)} p={[0, 0.05, 5.5]} s={[12, 0.05, 0.2]} />
  </>
);

const field: Arch = (a) => (
  <>
    <B m={new THREE.MeshStandardMaterial({ color: "#3a2a1a", roughness: 1 })} p={[0, 0.1, 0]} s={[12, 0.2, 11]} />
    {[-4, -2, 0, 2, 4].map((x) => (
      <B key={x} m={M.plant} p={[x, 0.5, 0]} s={[0.8, 0.6, 9]} />
    ))}
    <B m={M.hull} p={[5.5, 2, -4.5]} s={[0.3, 4, 0.3]} />
    <B g={G.cone} m={glow(a)} p={[5.5, 4.3, -4.5]} s={[0.4, 0.6, 0.4]} />
  </>
);

const fuelLot: Arch = (a) => (
  <>
    <B m={M.concrete} p={[0, 0.15, 0]} s={[12, 0.3, 11]} />
    {[-3.2, 0, 3.2].map((x) => (
      <group key={x}>
        <B g={G.cyl} m={M.hullLight} p={[x, 2.6, -2]} s={[1.4, 5, 1.4]} />
        <B g={G.dome} m={M.hullLight} p={[x, 5.1, -2]} s={[1.4, 0.8, 1.4]} />
        <B g={G.cyl} m={glow("#f5b301")} p={[x, 3.5, -2]} s={[1.42, 0.2, 1.42]} />
      </group>
    ))}
    <B m={M.hull} p={[0, 1.2, 3]} s={[2, 2.4, 1]} />
    <B m={glow(a)} p={[0, 2.2, 3.52]} s={[1.6, 0.3, 0.02]} />
  </>
);

const club: Arch = (a) => (
  <>
    <B m={M.hull} p={[0, 4, 0]} s={[11, 8, 9]} />
    <B m={new THREE.MeshStandardMaterial({ color: "#d4a93a", metalness: 0.9, roughness: 0.25 })} p={[0, 8.2, 0]} s={[11.4, 0.4, 9.4]} />
    {[-3, 0, 3].map((x) => (
      <B key={x} g={G.cyl} m={glow(x === 0 ? "#f5b301" : "#a855f7")} p={[x, 4, 4.6]} s={[0.15, 7.6, 0.15]} />
    ))}
    <B m={glow(a)} p={[0, 1, 4.52]} s={[11, 0.2, 0.05]} />
  </>
);

const station: Arch = (a) => (
  <>
    <B m={M.hullLight} p={[0, 3, 0]} s={[12, 6, 8]} />
    <B m={M.hull} p={[0, 6.4, 1]} s={[13, 0.6, 11]} />
    <B m={M.glass} p={[0, 2.5, 4.05]} s={[10, 4, 0.05]} />
    <B m={glow(a)} p={[0, 6.1, 6.5]} s={[13, 0.15, 0.05]} />
  </>
);

const ARCHES: Record<string, Arch> = {
  tower,
  beacon,
  observatory,
  dome,
  greenhouse,
  lab,
  hangar,
  dock,
  foundry: industrial(3),
  mining_claim: miningClaim,
  quarry,
  bunker,
  vault,
  armory,
  box: storefront(5, "#22d3ee"),
  stall: storefront(4.4, "#f97316"),
  cantina: storefront(5, "#ec4899"),
  outpost: bunker,
  loft,
  yard,
  scrapheap,
  array,
  field,
  fuel_lot: fuelLot,
  club,
  station,
};

/* ------------------------------ team models ------------------------------ */

/**
 * Property types drawn with the team's environment models instead of the
 * code-built archetypes. Each entry is one or more variants; a property picks
 * one by id (so it never changes), and a variant can be a small arrangement
 * of models (a fuel lot is a few tanks). The code archetype shows while the
 * model downloads and if it ever fails.
 */
type Piece = { id: EnvId; fit?: Fit; size: number; at?: [number, number]; ry?: number };
const MODEL_ARCHES: Partial<Record<string, Piece[][]>> = {
  hangar: [[{ id: "hangar", size: 13 }]],
  armory: [[{ id: "armory", size: 12 }], [{ id: "rock-armory-front", size: 12 }]],
  mining_claim: [[{ id: "automated-drilling", size: 12 }]],
  bunker: [[{ id: "bunker", size: 11 }]],
  outpost: [[{ id: "outpost", size: 11 }]],
  greenhouse: [[{ id: "greenhouse", size: 12 }]],
  dock: [[{ id: "ship-docking-stand", size: 13 }]],
  stall: [[{ id: "chimp-stand", size: 9 }]],
  tower: [[{ id: "tall-comms-tower", fit: "height", size: 24 }]],
  beacon: [[{ id: "basic-comms-tower", fit: "height", size: 15 }]],
  fuel_lot: [
    [
      { id: "fuel-tank-1", fit: "height", size: 7.5, at: [-3, -1] },
      { id: "fuel-tank-2", fit: "height", size: 7, at: [3, -1.5] },
      { id: "fuel-tank-4", size: 6, at: [0, 3.5], ry: 0.1 },
    ],
    [
      { id: "fuel-tank-5", fit: "height", size: 8, at: [-2.5, -1] },
      { id: "fuel-tank-3", fit: "height", size: 7.5, at: [3.5, 0] },
    ],
  ],
  yard: [
    [
      { id: "cargo-box", size: 5, at: [-3, -2] },
      { id: "cargo-box", size: 5, at: [2.5, -2.5], ry: 0.2 },
      { id: "cargo-box", size: 5, at: [3, 2.5], ry: Math.PI / 2 },
      { id: "fuel-tank-4", size: 5, at: [-3.5, 3], ry: -0.3 },
    ],
  ],
};

function pick<T>(list: T[], key: string): T {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}

/** Which team models (if any) draw this property. */
export function modelPiecesFor(type: string, id: string): Piece[] | null {
  const variants = MODEL_ARCHES[type];
  return variants ? pick(variants, id) : null;
}

function ModelBody({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((pc, i) => (
        <group key={i} position={[pc.at?.[0] ?? 0, 0, pc.at?.[1] ?? 0]} rotation={[0, pc.ry ?? 0, 0]}>
          <EnvModel id={pc.id} fit={pc.fit} size={pc.size} />
        </group>
      ))}
    </>
  );
}

/** Rough heights so signs float above each kind of building. */
const SIGN_HEIGHT: Record<string, number> = {
  tower: 26,
  beacon: 17,
  hangar: 9,
  observatory: 12,
  mining_claim: 13,
  dock: 13,
  foundry: 13,
  quarry: 9,
};

/* ------------------------------ art billboard ------------------------------ */

const textures = new Map<string, Promise<THREE.Texture>>();
function loadTexture(url: string): Promise<THREE.Texture> {
  let p = textures.get(url);
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(url).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
    textures.set(url, p);
  }
  return p;
}

function ArtBoard({ url, accent }: { url: string; accent: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let live = true;
    loadTexture(url)
      .then((t) => {
        if (live) setTex(t);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);

  const aspect = tex?.image ? (tex.image as { width: number }).width / (tex.image as { height: number }).height : 4 / 3;
  const h = 3.4;
  const w = Math.min(h * aspect, 5.2);
  return (
    <group>
      <B m={M.frame} p={[0, 0, -0.06]} s={[w + 0.35, h + 0.35, 0.1]} />
      <B m={glow(accent)} p={[0, -h / 2 - 0.2, 0]} s={[w + 0.35, 0.08, 0.04]} />
      <mesh geometry={G.plane} position={[0, 0, 0.001]} scale={[w, h, 1]}>
        {tex ? <meshBasicMaterial key="art" map={tex} toneMapped={false} /> : <meshBasicMaterial key="blank" color="#1a1726" />}
      </mesh>
      {/* legs */}
      <B m={M.frame} p={[-w / 2 + 0.3, -h / 2 - 1, -0.1]} s={[0.15, 2, 0.15]} />
      <B m={M.frame} p={[w / 2 - 0.3, -h / 2 - 1, -0.1]} s={[0.15, 2, 0.15]} />
    </group>
  );
}

function Sign({ prop, accent, y, hidden }: { prop: WorldProperty; accent: string; y: number; hidden: boolean }) {
  return (
    <Html position={[0, y, 0]} center distanceFactor={15} zIndexRange={[5, 0]} style={{ pointerEvents: "none", display: hidden ? "none" : undefined }}>
      <div
        className="whitespace-nowrap rounded-md bg-black/80 px-2.5 py-1 text-center text-white shadow-lg"
        style={{ borderBottom: `3px solid ${accent}` }}
      >
        <div className="text-[13px] font-bold uppercase tracking-wider">{prop.name}</div>
        <div className="text-[10px] uppercase tracking-wide text-white/55">{prop.type.replace(/_/g, " ")}</div>
        {prop.forSale ? (
          <div className="text-[11px] font-semibold text-emerald-300">For sale · {prop.priceChimp.toLocaleString()} $CHIMP</div>
        ) : (
          <div className="text-[11px] text-amber-200">Owned by {prop.ownerHandle}</div>
        )}
      </div>
    </Html>
  );
}

/* ------------------------------ building ------------------------------ */

export const Building = memo(function Building({
  prop,
  place,
  accent,
  near,
  labelMounted,
}: {
  prop: WorldProperty;
  place: Placement;
  accent: string;
  /** Close enough to load art and show the sign. */
  near: boolean;
  /** Sign has been shown before: keep it mounted (hidden when far) instead of remounting. */
  labelMounted: boolean;
}) {
  const arch = ARCHES[prop.type] ?? storefront(5, accent);
  const code = useMemo(() => arch(accent), [arch, accent]);
  const pieces = modelPiecesFor(prop.type, prop.id);
  // Team model when there is one; the code archetype stands in while it loads.
  const body = pieces ? (
    <Suspense fallback={code}>
      <ModelBody pieces={pieces} />
    </Suspense>
  ) : (
    code
  );
  return (
    <group position={[place.x, 0, place.z]} rotation={[0, place.ry, 0]}>
      {/* lot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={G.plane} scale={[14, 14, 1]}>
        <meshStandardMaterial color="#2e2a3c" metalness={0.25} roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 6.95]} geometry={G.plane} scale={[14, 0.12, 1]} material={glow(accent)} />
      <group position={[0, 0, -1.5]}>{body}</group>
      {/* art billboard at the front edge of the lot */}
      <group position={[4, 3.9, 6.2]} rotation={[0, -0.25, 0]}>
        {near && prop.image ? <ArtBoard url={prop.image} accent={accent} /> : <B m={M.frame} p={[0, 0, 0]} s={[4.8, 3.6, 0.1]} />}
      </group>
      {/* what this property produces, on a pedestal at the front of the lot */}
      {near && productFor(prop.type, prop.id) && (
        <group position={[-2.6, 0, 5.4]}>
          <ItemPedestal id={productFor(prop.type, prop.id)!} size={1} />
        </group>
      )}
      {prop.forSale && (
        <mesh position={[-5.5, 0.9, 6]}>
          <boxGeometry args={[1.4, 1.8, 0.1]} />
          <meshBasicMaterial color="#10b981" toneMapped={false} />
        </mesh>
      )}
      {(near || labelMounted) && <Sign prop={prop} accent={accent} y={SIGN_HEIGHT[prop.type] ?? 10.5} hidden={!near} />}
    </group>
  );
});
