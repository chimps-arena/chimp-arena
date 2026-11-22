"use client";

/**
 * Astroburger: an Astrocorp landmark diner in the Core (not a market
 * property). The team's dining-hall art on the facade, an outdoor terrace,
 * the menu on pedestals, and Drink Mixer working the counter. E at the door
 * opens the menu.
 */

import { useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { CORE_ZONE, type Cover } from "@chimp-arena/shared";
import type { WorldProperty } from "./buildings";
import { ItemPedestal } from "./items";
import { registerInteractable, type NpcSpec } from "./npcs";

/** Diner position in the Core: south of HQ, facing the tower. */
export const ASTROBURGER = { x: 0, z: -60, ry: 0 };

/** The landmark as a "property" so the shared property panel can show its menu. */
export const ASTROBURGER_PLACE: WorldProperty = {
  id: "landmark-astroburger",
  name: "Astroburger",
  zone: CORE_ZONE,
  type: "cantina",
  priceChimp: 0,
  image: "/astroworld/astroburger/dining.webp",
  ownerHandle: "Astrocorp Lifestyle Division",
  forSale: false,
};

/** Walls + terrace tables as colliders. */
export const ASTROBURGER_COVERS: Cover[] = [
  [ASTROBURGER.x - 5, ASTROBURGER.z - 2, 5.5, 8],
  [ASTROBURGER.x + 5, ASTROBURGER.z - 2, 5.5, 8],
];

const wall = new THREE.MeshStandardMaterial({ color: "#2a1f3a", metalness: 0.5, roughness: 0.35 });
const trim = new THREE.MeshBasicMaterial({ color: "#f5b301", toneMapped: false });
const neon = new THREE.MeshBasicMaterial({ color: "#c084fc", toneMapped: false });
const table = new THREE.MeshStandardMaterial({ color: "#d4d0e0", metalness: 0.7, roughness: 0.25 });
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 20);

function useTexture(url: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let live = true;
    let t: THREE.Texture | null = null;
    new THREE.TextureLoader()
      .loadAsync(url)
      .then((loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        t = loaded;
        if (live) setTex(loaded);
      })
      .catch(() => {});
    return () => {
      live = false;
      t?.dispose();
    };
  }, [url]);
  return tex;
}

const DOOR_SPEC: NpcSpec = {
  key: "landmark-astroburger",
  characterId: "",
  role: "Astrocorp landmark · Core",
  title: "Astroburger",
  kind: "property",
  property: ASTROBURGER_PLACE,
  range: 6,
  route: { kind: "post", at: [ASTROBURGER.x, ASTROBURGER.z + 8], face: 0 },
  speed: 0,
  phase: 0,
};

export function Astroburger() {
  useEffect(() => registerInteractable(DOOR_SPEC, ASTROBURGER.x, ASTROBURGER.z + 8), []);
  const dining = useTexture("/astroworld/astroburger/dining.webp");
  const counter = useTexture("/astroworld/astroburger/counter.webp");
  const tables = useMemo(
    () => [
      [-9, 9],
      [-4, 11],
      [4, 11],
      [9, 9],
    ],
    [],
  );
  return (
    <group position={[ASTROBURGER.x, 0, ASTROBURGER.z]} rotation={[0, ASTROBURGER.ry, 0]}>
      {/* the diner: a long low hall with a glowing roofline */}
      <mesh geometry={box} material={wall} position={[0, 3.5, -2]} scale={[20, 7, 9]} />
      <mesh geometry={box} material={trim} position={[0, 7.05, 2.55]} scale={[20.2, 0.18, 0.1]} />
      <mesh geometry={box} material={neon} position={[0, 0.25, 2.55]} scale={[20.2, 0.12, 0.1]} />
      {/* facade: the dining hall art either side of the door, the counter art above it */}
      <mesh position={[-5.6, 3.4, 2.56]}>
        <planeGeometry args={[8.2, 4.6]} />
        {dining ? <meshBasicMaterial key="art" map={dining} toneMapped={false} /> : <meshBasicMaterial key="blank" color="#1a1238" />}
      </mesh>
      <mesh position={[5.6, 3.4, 2.56]}>
        <planeGeometry args={[8.2, 4.6]} />
        {counter ? <meshBasicMaterial key="art" map={counter} toneMapped={false} /> : <meshBasicMaterial key="blank" color="#1a1238" />}
      </mesh>
      {/* door */}
      <mesh geometry={box} position={[0, 1.9, 2.57]} scale={[2.6, 3.8, 0.05]}>
        <meshBasicMaterial color="#f5b301" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {/* sign */}
      <Html position={[0, 8.6, 2.6]} center transform distanceFactor={9} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded-lg border-2 border-fuchsia-400 bg-[#1a0f2e]/90 px-5 py-2 text-center shadow-[0_0_30px_rgba(217,70,239,0.7)]">
          <div className="text-3xl font-black tracking-wider text-fuchsia-200">ASTROBURGER</div>
          <div className="text-xs font-bold tracking-[0.3em] text-amber-300">EAT · RECHARGE · CONQUER</div>
        </div>
      </Html>
      {/* terrace */}
      {tables.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh geometry={cyl} material={table} position={[0, 0.95, 0]} scale={[0.9, 0.08, 0.9]} />
          <mesh geometry={cyl} material={table} position={[0, 0.48, 0]} scale={[0.08, 0.95, 0.08]} />
          <mesh geometry={cyl} material={neon} position={[0, 1.0, 0]} scale={[0.92, 0.02, 0.92]} />
        </group>
      ))}
      {/* the menu, on pedestals out front */}
      <group position={[-3.4, 0, 5.5]}>
        <ItemPedestal id="meal" size={1} />
      </group>
      <group position={[0, 0, 6.2]}>
        <ItemPedestal id="power-bar" size={1} />
      </group>
      <group position={[3.4, 0, 5.5]}>
        <ItemPedestal id="drink" size={1} />
      </group>
      <pointLight position={[0, 5, 7]} color="#e879f9" intensity={40} distance={18} />
    </group>
  );
}
