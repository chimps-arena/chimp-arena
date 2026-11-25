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

import { useLayoutEffect, useMemo, useRef } from "react";
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
  | "foundry"
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
  | "solar-panel-2"
  | "vault";

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
  "vault",
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
  return id === "foundry" ? <FoundryModel model={model} /> : <primitive object={model} />;
}

/** Animate only the GLB's dedicated molten material. Rock, steel and rim stay unchanged. */
function FoundryModel({ model }: { model: THREE.Object3D }) {
  const time = useRef({ value: 0 });
  useFrame(({ clock }) => { time.current.value = clock.elapsedTime % 120; });

  useLayoutEffect(() => {
    const uniform = time.current;
    const clones = new Map<THREE.Material, THREE.Material>();
    function animate(material: THREE.Material) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name !== "Molten ore") return material;
      const cached = clones.get(material);
      if (cached) return cached;
      const molten = material.clone();
      molten.onBeforeCompile = (shader) => {
        shader.uniforms.foundryMoltenTime = uniform;
        shader.vertexShader = shader.vertexShader.replace("#include <common>", `
          #include <common>
          varying vec3 foundryMoltenPosition;
        `).replace("#include <begin_vertex>", `
          #include <begin_vertex>
          foundryMoltenPosition = position;
        `);
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `
          #include <common>
          varying vec3 foundryMoltenPosition;
          uniform float foundryMoltenTime;
        `).replace("#include <emissivemap_fragment>", `
          #include <emissivemap_fragment>
          // Coordinates are in the original GLB mesh, before placement and lot rotation.
          vec3 p = foundryMoltenPosition;
          float t = foundryMoltenTime;
          float alongFlow = -p.y * 210.0 + p.z * 65.0;
          float lanes = sin(p.x * 155.0 + p.y * 20.0) * 0.5 + 0.5;
          float streak = pow(0.5 + 0.5 * sin(alongFlow + sin(p.x * 126.0) * 1.5 - t * 12.5663706), 3.0);
          float fine = 0.5 + 0.5 * sin(alongFlow * 1.63 + p.x * 176.0 - t * 18.8495559);
          float stream = 0.12 + streak * mix(0.19, 0.47, lanes) + 0.06 * fine;
          float poolRadius = length(p.xz - vec2(0.031, 0.304));
          float ripples = 0.5 + 0.5 * sin(poolRadius * 260.0 - t * 12.5663706);
          float pool = 0.14 + 0.21 * ripples * ripples;
          float falling = smoothstep(-0.381, -0.369, p.y);
          totalEmissiveRadiance += vec3(1.0, 0.27, 0.025) * mix(pool, stream, falling);
        `);
      };
      molten.customProgramCacheKey = () => "foundry-molten-flow-v1";
      clones.set(material, molten);
      return molten;
    }

    const restored: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.material;
      const next = Array.isArray(original) ? original.map(animate) : animate(original);
      const changed = Array.isArray(original) && Array.isArray(next)
        ? original.some((material, i) => material !== next[i])
        : original !== next;
      if (!changed) return;
      restored.push({ mesh: object, material: original });
      object.material = next;
    });
    return () => {
      for (const { mesh, material } of restored) mesh.material = material;
      for (const clone of clones.values()) clone.dispose();
    };
  }, [model]);

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
