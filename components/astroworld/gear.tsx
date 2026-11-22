"use client";

/**
 * Weapon and mining kits: the team's rifle tiers (Standard, Power 1-5) and
 * mining tools (Tier 1-3), optimized into public/models/weapons and
 * public/models/tools by scripts/optimize-models.mjs (kit-models.manifest.json).
 */

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export type WeaponId = "rifle-standard" | "rifle-power-1" | "rifle-power-2" | "rifle-power-3" | "rifle-power-4" | "rifle-power-5";
export type ToolId = "pickaxe-t1" | "jackhammer-t2" | "plasma-cutter-t3";
export type GearId = WeaponId | ToolId;

export const WEAPONS: Record<WeaponId, { name: string; tier: string; glow: string }> = {
  "rifle-standard": { name: "Standard Rifle", tier: "Standard", glow: "#94a3b8" },
  "rifle-power-1": { name: "Power 1 Rifle", tier: "Power 1", glow: "#22c55e" },
  "rifle-power-2": { name: "Power 2 Rifle", tier: "Power 2", glow: "#3b82f6" },
  "rifle-power-3": { name: "Power 3 Rifle", tier: "Power 3", glow: "#a855f7" },
  "rifle-power-4": { name: "Astral Tempest", tier: "Power 4", glow: "#f59e0b" },
  "rifle-power-5": { name: "Power 5 Rifle", tier: "Power 5", glow: "#ef4444" },
};
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export const TOOLS: Record<ToolId, { name: string; tier: string; glow: string }> = {
  "pickaxe-t1": { name: "Charged Pickaxe", tier: "Mining · Tier 1", glow: "#22d3ee" },
  "jackhammer-t2": { name: "Jackhammer Drill", tier: "Mining · Tier 2", glow: "#f59e0b" },
  "plasma-cutter-t3": { name: "Plasma Cutter", tier: "Mining · Tier 3", glow: "#a855f7" },
};
export const TOOL_IDS = Object.keys(TOOLS) as ToolId[];

const isWeapon = (id: GearId): id is WeaponId => id.startsWith("rifle-");
export const gearUrl = (id: GearId) => `/models/${isWeapon(id) ? "weapons" : "tools"}/${id}.glb`;

/**
 * A kit model scaled so its longest side is `length` metres, centred on the
 * origin (weapons and tools are held or racked, not stood on the ground).
 */
export function GearModel({ id, length }: { id: GearId; length: number }) {
  const gltf = useGLTF(gearUrl(id), false, true);
  const model = useMemo(() => {
    const s = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const d = box.getSize(new THREE.Vector3());
    const k = length / Math.max(d.x, d.y, d.z, 1e-6);
    s.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x * k, -c.y * k, -c.z * k);
    return s;
  }, [gltf.scene, length]);
  return <primitive object={model} />;
}

export function preloadGear(ids: GearId[]) {
  for (const id of ids) useGLTF.preload(gearUrl(id), false, true);
}

/* ------------------------------ displays ------------------------------ */

const rackMat = new THREE.MeshStandardMaterial({ color: "#2a2638", metalness: 0.7, roughness: 0.3 });
const rackGeo = new THREE.BoxGeometry(1, 1, 1);

/**
 * An armory's weapon rack: every rifle tier, Standard at the bottom up to
 * Power 5 at the top, each on a glowing tier-coloured rail.
 */
export function WeaponRack() {
  return (
    <group>
      {/* frame */}
      <mesh geometry={rackGeo} material={rackMat} position={[-1.35, 1.6, -0.1]} scale={[0.12, 3.2, 0.12]} />
      <mesh geometry={rackGeo} material={rackMat} position={[1.35, 1.6, -0.1]} scale={[0.12, 3.2, 0.12]} />
      <mesh geometry={rackGeo} material={rackMat} position={[0, 1.6, -0.2]} scale={[2.8, 3.2, 0.06]} />
      {WEAPON_IDS.map((id, i) => (
        <group key={id} position={[0, 0.35 + i * 0.5, 0]}>
          <mesh position={[0, -0.16, -0.12]} scale={[2.5, 0.03, 0.03]} geometry={rackGeo}>
            <meshBasicMaterial color={WEAPONS[id].glow} toneMapped={false} />
          </mesh>
          <Suspense fallback={null}>
            <GearModel id={id} length={2.2} />
          </Suspense>
        </group>
      ))}
    </group>
  );
}

/** A mining tool on a small lit stand, turning slowly. */
export function ToolStand({ id }: { id: ToolId }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.5;
  });
  return (
    <group>
      <mesh geometry={rackGeo} material={rackMat} position={[0, 0.4, 0]} scale={[1, 0.8, 1]} />
      <mesh position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 32]} />
        <meshBasicMaterial color={TOOLS[id].glow} toneMapped={false} />
      </mesh>
      <group ref={spin} position={[0, 1.75, 0]}>
        <Suspense fallback={null}>
          <GearModel id={id} length={1.6} />
        </Suspense>
      </group>
    </group>
  );
}

/** Pick one tool per mining property, deterministically. */
export function toolFor(propertyId: string): ToolId {
  let h = 0;
  for (const c of propertyId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TOOL_IDS[Math.abs(h) % TOOL_IDS.length];
}
