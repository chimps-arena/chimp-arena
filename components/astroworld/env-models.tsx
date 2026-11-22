"use client";

/**
 * The team's environment models (public/models/env/, optimized from the
 * "Environment Assets" delivery by scripts/optimize-models.mjs) and the
 * companion pets (public/models/pets/).
 *
 * The deliveries come normalized to a ~1 unit box, so every use states the
 * real-world size it should be: `fit: "width"` scales the larger footprint
 * side to `size` metres, `fit: "height"` scales the height (towers).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export type EnvId =
  | "armory"
  | "automated-drilling"
  | "basic-comms-tower"
  | "bunker"
  | "cargo-box"
  | "chimp-stand"
  | "fuel-tank-1"
  | "fuel-tank-2"
  | "fuel-tank-3"
  | "fuel-tank-4"
  | "fuel-tank-5"
  | "greenhouse"
  | "hangar"
  | "outpost"
  | "rock-armory-front"
  | "ship-docking-stand"
  | "tall-comms-tower"
  | "solar-panel-1"
  | "solar-panel-2";

export const ENV_IDS: EnvId[] = [
  "armory",
  "rock-armory-front",
  "automated-drilling",
  "bunker",
  "outpost",
  "hangar",
  "greenhouse",
  "ship-docking-stand",
  "chimp-stand",
  "cargo-box",
  "basic-comms-tower",
  "tall-comms-tower",
  "fuel-tank-1",
  "fuel-tank-2",
  "fuel-tank-3",
  "fuel-tank-4",
  "fuel-tank-5",
  "solar-panel-1",
  "solar-panel-2",
];

export type PetId = "astrodog" | "astrokitty";

const envUrl = (id: EnvId) => `/models/env/${id}.glb`;
const petUrl = (id: PetId) => `/models/pets/${id}.glb`;

export type Fit = "width" | "height";

/** Clone a loaded scene, scale it to `size` metres along `fit`, feet on y=0, centred. */
function fitted(scene: THREE.Object3D, fit: Fit, size: number) {
  const s = scene.clone(true);
  const box = new THREE.Box3().setFromObject(s);
  const d = box.getSize(new THREE.Vector3());
  const k = size / Math.max(fit === "height" ? d.y : Math.max(d.x, d.z), 1e-6);
  s.scale.setScalar(k);
  const c = box.getCenter(new THREE.Vector3());
  s.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  return s;
}

export function EnvModel({ id, fit = "width", size }: { id: EnvId; fit?: Fit; size: number }) {
  // Meshopt-compressed: decoded locally, no third-party decoder download.
  const gltf = useGLTF(envUrl(id), false, true);
  const model = useMemo(() => fitted(gltf.scene, fit, size), [gltf.scene, fit, size]);
  return <primitive object={model} />;
}

export function preloadEnv(ids: EnvId[]) {
  for (const id of ids) useGLTF.preload(envUrl(id), false, true);
}

/* ------------------------------ pets ------------------------------ */

/**
 * A companion pet that pads around a small loop near its spot. The pet models
 * aren't rigged, so the motion is a body bob and sway, not a walk cycle.
 */
export function Pet({ id, size, radius = 2.5, speed = 0.35, phase = 0 }: { id: PetId; size: number; radius?: number; speed?: number; phase?: number }) {
  const gltf = useGLTF(petUrl(id), false, true);
  const model = useMemo(() => fitted(gltf.scene, "height", size), [gltf.scene, size]);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => tickPet(body.current, clock.elapsedTime * speed + phase, radius, size));
  return (
    <group ref={body}>
      <primitive object={model} />
    </group>
  );
}

/** Frame step for a pet (outside the component: it mutates a three.js object). */
function tickPet(g: THREE.Group | null, t: number, radius: number, size: number) {
  if (!g) return;
  // A lazy figure-eight, facing the way it's going, with a trotting bob.
  const x = Math.sin(t) * radius;
  const z = Math.sin(t * 2) * radius * 0.5;
  const dx = Math.cos(t) * radius;
  const dz = Math.cos(t * 2) * radius;
  g.position.set(x, Math.abs(Math.sin(t * 14)) * 0.05 * size, z);
  g.rotation.set(0, Math.atan2(dx, dz), Math.sin(t * 14) * 0.04);
}

export function preloadPets() {
  for (const id of ["astrodog", "astrokitty"] as PetId[]) useGLTF.preload(petUrl(id), false, true);
}
