"use client";

/**
 * Combat effects and the rover model.
 *
 * Effects go through a tiny module-level event bus so anything (the local
 * shooter, network messages) can fire a tracer or a muzzle flash without
 * threading callbacks through the scene. The page is client-only, so one
 * shared bus per tab is exactly right.
 */

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "@chimp-arena/shared";

type FxEvent =
  | { kind: "tracer"; from: Vec3; to: Vec3; color: string }
  | { kind: "flash"; at: Vec3 }
  | { kind: "impact"; at: Vec3 };

type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();

export const fx = {
  emit(e: FxEvent) {
    for (const l of listeners) l(e);
  },
  on(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

const POOL = 48;
const TRACER_LIFE = 0.09;
const FLASH_LIFE = 0.05;
const IMPACT_LIFE = 0.25;
const Y = new THREE.Vector3(0, 1, 0);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
const unitSphere = new THREE.SphereGeometry(1, 8, 6);

interface Slot {
  mesh: THREE.Mesh;
  life: number;
  max: number;
}

/** Fade and retire effects; returns the muzzle light's remaining life. */
function tickEffects(slots: Slot[], light: THREE.PointLight | null, lightLife: number, dt: number): number {
  for (const s of slots) {
    if (!s.mesh.visible) continue;
    s.life -= dt;
    if (s.life <= 0) {
      s.mesh.visible = false;
      continue;
    }
    (s.mesh.material as THREE.MeshBasicMaterial).opacity = s.life / s.max;
  }
  const left = Math.max(0, lightLife - dt);
  if (light) light.intensity = left > 0 ? 30 : 0;
  return left;
}

/** Renders pooled tracers, flashes and impact sparks. Mount once in the Canvas. */
export function Effects() {
  const group = useRef<THREE.Group>(null);
  const slots = useRef<Slot[]>([]);
  const next = useRef(0);
  const flashLight = useRef<THREE.PointLight>(null);
  const flashLife = useRef(0);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const made: Slot[] = [];
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(unitCyl, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, toneMapped: false, depthWrite: false }));
      mesh.visible = false;
      g.add(mesh);
      made.push({ mesh, life: 0, max: 1 });
    }
    slots.current = made;
    const tmp = new THREE.Vector3();

    const off = fx.on((e) => {
      const slot = made[next.current++ % POOL];
      const mat = slot.mesh.material as THREE.MeshBasicMaterial;
      if (e.kind === "tracer") {
        const a = new THREE.Vector3(e.from.x, e.from.y, e.from.z);
        const b = new THREE.Vector3(e.to.x, e.to.y, e.to.z);
        const len = a.distanceTo(b);
        if (len < 0.1) return;
        slot.mesh.geometry = unitCyl;
        slot.mesh.position.copy(a).add(b).multiplyScalar(0.5);
        slot.mesh.quaternion.setFromUnitVectors(Y, tmp.copy(b).sub(a).normalize());
        slot.mesh.scale.set(0.025, len, 0.025);
        mat.color.set(e.color);
        slot.max = slot.life = TRACER_LIFE;
      } else if (e.kind === "flash") {
        slot.mesh.geometry = unitSphere;
        slot.mesh.position.set(e.at.x, e.at.y, e.at.z);
        slot.mesh.scale.setScalar(0.18);
        mat.color.set("#ffe7a3");
        slot.max = slot.life = FLASH_LIFE;
        if (flashLight.current) {
          flashLight.current.position.set(e.at.x, e.at.y, e.at.z);
          flashLife.current = FLASH_LIFE;
        }
      } else {
        slot.mesh.geometry = unitSphere;
        slot.mesh.position.set(e.at.x, e.at.y, e.at.z);
        slot.mesh.scale.setScalar(0.12);
        mat.color.set("#ffb347");
        slot.max = slot.life = IMPACT_LIFE;
      }
      slot.mesh.visible = true;
      mat.opacity = 1;
    });

    return () => {
      off();
      for (const s of made) {
        g.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
      }
    };
  }, []);

  useFrame((_, dt) => {
    flashLife.current = tickEffects(slots.current, flashLight.current, flashLife.current, dt);
  });

  return (
    <group ref={group}>
      <pointLight ref={flashLight} color="#ffd27a" intensity={0} distance={8} />
    </group>
  );
}

/* ------------------------------- rover ------------------------------- */

const WHEEL_Z = [-1.15, 0, 1.15];

/** The 6x6 Astrorover, striped in its driver's NFT colours. */
export function RoverModel({ color, accent = "#f5b301" }: { color: string; accent?: string }) {
  return (
    <group>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[2.1, 0.8, 3.6]} />
        <meshStandardMaterial color="#e8e6ef" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* open cockpit tub and roll cage, so the driver shows */}
      <mesh position={[0, 1.4, -0.2]}>
        <boxGeometry args={[1.8, 0.12, 2]} />
        <meshStandardMaterial color="#1a1726" metalness={0.8} roughness={0.2} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 2.1, -0.4]}>
          <boxGeometry args={[0.08, 1.3, 0.08]} />
          <meshStandardMaterial color="#1a1726" metalness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 2.75, -0.4]}>
        <boxGeometry args={[1.78, 0.08, 0.08]} />
        <meshStandardMaterial color="#1a1726" metalness={0.8} />
      </mesh>
      {[-1.06, 1.06].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]}>
          <boxGeometry args={[0.02, 0.14, 3.2]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 1.05, 1.81]}>
          <boxGeometry args={[0.4, 0.14, 0.02]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      ))}
      {WHEEL_Z.flatMap((z) =>
        [-1.15, 1.15].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.5, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.5, 0.5, 0.42, 16]} />
            <meshStandardMaterial color="#141218" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
}
