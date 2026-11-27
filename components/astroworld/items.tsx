"use client";

/**
 * The economy's items as real 3D models (the team's .glb deliveries,
 * optimized by scripts/optimize-models.mjs into public/models/items/).
 *
 * - ItemModel: one item, scaled to a target size, gently floating/spinning.
 * - ChargedCrystal: the Charged Crystal with its animated charge effect.
 * - ResourceExchange: the display ring in the Core - each raw ore beside its
 *   refined form, with the Charged Crystal in pride of place.
 * - PRODUCT_BY_TYPE: what each property type produces, shown at its lot.
 */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Html } from "./drei-html";
import * as THREE from "three";
import { ModelErrorBoundary } from "./model-error-boundary";

export type ItemId =
  | "ore-gold"
  | "ore-cobalt"
  | "ore-palladium"
  | "ore-crystal"
  | "bar-gold"
  | "bar-cobalt"
  | "bar-palladium"
  | "crystal-cut"
  | "crystal-charged"
  | "kit-fuel"
  | "kit-charge"
  | "kit-drink"
  | "kit-food"
  | "nutrition-cell"
  | "meal"
  | "power-bar"
  | "drink"
  | "drink-canister"
  | "crystal-charged-v2";

export const ITEMS: Record<ItemId, { name: string; kind: string; glow: string }> = {
  "ore-gold": { name: "Gold Ore", kind: "Raw ore", glow: "#f5b301" },
  "ore-cobalt": { name: "Cobalt Ore", kind: "Raw ore", glow: "#3b82f6" },
  "ore-palladium": { name: "Palladium Ore", kind: "Raw ore", glow: "#cbd5e1" },
  "ore-crystal": { name: "Uncut Void Crystal", kind: "Raw ore", glow: "#a855f7" },
  "bar-gold": { name: "Gold Bar", kind: "Refined", glow: "#f5b301" },
  "bar-cobalt": { name: "Cobalt Bar", kind: "Refined", glow: "#3b82f6" },
  "bar-palladium": { name: "Palladium Bar", kind: "Refined", glow: "#cbd5e1" },
  "crystal-cut": { name: "Cut Void Crystal", kind: "Refined", glow: "#a855f7" },
  "crystal-charged": { name: "Charged Crystal", kind: "Void Crystal + Charge Kit", glow: "#c084fc" },
  "kit-fuel": { name: "Fuel Kit", kind: "Consumable", glow: "#f97316" },
  "kit-charge": { name: "Charge Kit", kind: "Consumable", glow: "#22d3ee" },
  "kit-drink": { name: "Moisture Kit", kind: "Consumable", glow: "#38bdf8" },
  "kit-food": { name: "Food Kit", kind: "Consumable", glow: "#22c55e" },
  "nutrition-cell": { name: "Nutrition Suit Cell", kind: "Astrofoods · Consumable", glow: "#84cc16" },
  meal: { name: "Meal", kind: "Astrofoods · Consumable", glow: "#22c55e" },
  "power-bar": { name: "Power Bar", kind: "Astrofoods · Snack", glow: "#eab308" },
  drink: { name: "Drink", kind: "Astrofoods · Consumable", glow: "#38bdf8" },
  "drink-canister": { name: "Suit Cell Drink Canister", kind: "Astrofoods · Consumable", glow: "#06b6d4" },
  "crystal-charged-v2": { name: "Charged Crystal (new mesh)", kind: "Review", glow: "#c084fc" },
};

const url = (id: ItemId) => `/models/items/${id}.glb`;

/** What each property type produces - shown in front of its building. */
export const PRODUCT_BY_TYPE: Partial<Record<string, ItemId[]>> = {
  mining_claim: ["ore-gold", "ore-cobalt", "ore-palladium", "ore-crystal"],
  quarry: ["ore-cobalt", "ore-palladium"],
  foundry: ["bar-gold", "bar-cobalt", "bar-palladium"],
  vault: ["bar-gold", "crystal-cut"],
  fuel_lot: ["kit-fuel"],
  array: ["kit-charge"],
  greenhouse: ["kit-food", "kit-drink", "nutrition-cell"],
  dome: ["nutrition-cell", "drink-canister"],
  field: ["kit-food", "nutrition-cell"],
  cantina: ["drink", "drink-canister", "kit-drink", "meal", "power-bar"],
  stall: ["meal", "power-bar", "nutrition-cell"],
  club: ["drink", "meal"],
};

/** Pick one product deterministically per property, so it never flickers. */
export function productFor(type: string, propertyId: string): ItemId | null {
  const list = PRODUCT_BY_TYPE[type];
  if (!list) return null;
  let h = 0;
  for (const c of propertyId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}

/* ------------------------------ models ------------------------------ */

/**
 * One item model scaled so its largest side is `size` metres, resting on y=0.
 * Clones the cached glTF so many copies can share one download.
 */
export function ItemModel({ id, size = 1, float = true }: { id: ItemId; size?: number; float?: boolean }) {
  // Meshopt-compressed: decoded locally, no third-party decoder download.
  const gltf = useGLTF(url(id), false, true);
  const group = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const s = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const dims = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dims.x, dims.y, dims.z, 1e-6);
    s.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    return s;
  }, [gltf.scene, size]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || !float) return;
    const t = clock.elapsedTime + size * 3.1;
    g.rotation.y = t * 0.45;
    g.position.y = 0.12 + Math.sin(t * 1.4) * 0.06 * size;
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

/** The Charged Crystal: pulsing violet charge, energy halo, orbiting sparks. */
export function ChargedCrystal({ size = 1.6 }: { size?: number }) {
  const gltf = useGLTF(url("crystal-charged"), false, true);
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const sparks = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);

  const { model, mats } = useMemo(() => {
    const s = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const dims = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dims.x, dims.y, dims.z, 1e-6);
    s.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    // Own material copies so the pulse doesn't leak into other crystals.
    const ms: THREE.MeshStandardMaterial[] = [];
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone();
        m.emissive = new THREE.Color("#a855f7");
        mesh.material = m;
        ms.push(m);
      }
    });
    return { model: s, mats: ms };
  }, [gltf.scene, size]);

  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  useFrame(({ clock }) => tickCharge(clock.elapsedTime, size, group.current, halo.current, sparks.current, light.current, mats));

  return (
    <group ref={group}>
      <primitive object={model} />
      <mesh ref={halo} position={[0, size * 0.5, 0]}>
        <sphereGeometry args={[size * 0.55, 24, 16]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <group ref={sparks} position={[0, size * 0.5, 0]}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * size * 0.6, Math.sin(a * 2) * size * 0.2, Math.sin(a) * size * 0.6]}>
              <sphereGeometry args={[0.04 * size, 8, 6]} />
              <meshBasicMaterial color="#e9d5ff" toneMapped={false} />
            </mesh>
          );
        })}
      </group>
      <pointLight ref={light} position={[0, size * 0.5, 0]} color="#a855f7" distance={8} intensity={8} />
    </group>
  );
}

/** Frame step for the charge effect (outside the component: it mutates three.js objects). */
function tickCharge(
  t: number,
  size: number,
  group: THREE.Group | null,
  halo: THREE.Mesh | null,
  sparks: THREE.Group | null,
  light: THREE.PointLight | null,
  mats: THREE.MeshStandardMaterial[],
) {
  // A charge "heartbeat": quick double pulse, then rest.
  const beat = Math.pow(Math.max(0, Math.sin(t * 2.2)), 6) + 0.6 * Math.pow(Math.max(0, Math.sin(t * 2.2 - 0.6)), 8);
  for (const m of mats) m.emissiveIntensity = 0.35 + beat * 1.6;
  if (group) {
    group.rotation.y = t * 0.35;
    group.position.y = 0.2 + Math.sin(t * 1.1) * 0.08 * size;
  }
  if (halo) {
    halo.scale.setScalar(1 + beat * 0.25);
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.1 + beat * 0.25;
  }
  if (sparks) sparks.rotation.y = -t * 1.6;
  if (light) light.intensity = 4 + beat * 14;
}

/* ------------------------------ displays ------------------------------ */

const pedestalMat = new THREE.MeshStandardMaterial({ color: "#4a4466", metalness: 0.6, roughness: 0.3 });
const pedestalGeo = new THREE.CylinderGeometry(0.9, 1.05, 0.9, 6);

/** Label that shows only when the camera is close - toggled via the DOM, no re-render. */
export function NearLabel({ title, sub, color, y, within = 22 }: { title: string; sub: string; color: string; y: number; within?: number }) {
  const div = useRef<HTMLDivElement>(null);
  const anchor = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => showWhenNear(anchor.current, div.current, camera, v, within));
  return (
    <group ref={anchor} position={[0, y, 0]}>
      <Html center distanceFactor={10} zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
        <div ref={div} className="whitespace-nowrap rounded bg-black/75 px-2 py-0.5 text-center text-white" style={{ borderBottom: `2px solid ${color}`, display: "none" }}>
          <div className="text-[12px] font-bold">{title}</div>
          <div className="text-[9px] uppercase tracking-wider text-white/60">{sub}</div>
        </div>
      </Html>
    </group>
  );
}

function showWhenNear(anchor: THREE.Object3D | null, div: HTMLDivElement | null, camera: THREE.Camera, v: THREE.Vector3, within: number) {
  if (!anchor || !div) return;
  anchor.getWorldPosition(v);
  const show = v.distanceTo(camera.position) < within;
  const want = show ? "block" : "none";
  if (div.style.display !== want) div.style.display = want;
}

export function ItemPedestal({ id, size = 1.1, label = true }: { id: ItemId; size?: number; label?: boolean }) {
  const item = ITEMS[id];
  return (
    <group>
      <mesh geometry={pedestalGeo} material={pedestalMat} position={[0, 0.45, 0]} />
      <mesh position={[0, 0.91, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.85, 6]} />
        <meshBasicMaterial color={item.glow} toneMapped={false} />
      </mesh>
      <group position={[0, 0.95, 0]}>
        {/* A failed download leaves an empty pedestal, not a crashed game. */}
        <ModelErrorBoundary fallback={null} what={`item model (${id})`}>
          <Suspense fallback={null}>{id === "crystal-charged" ? <ChargedCrystal size={size * 1.4} /> : <ItemModel id={id} size={size} />}</Suspense>
        </ModelErrorBoundary>
      </group>
      {label && <NearLabel title={item.name} sub={item.kind} color={item.glow} y={size + 2.4} />}
    </group>
  );
}

/** Raw ore beside its refined form, on a ring around Astrocorp HQ. */
const EXCHANGE: ItemId[] = ["ore-gold", "bar-gold", "ore-cobalt", "bar-cobalt", "ore-palladium", "bar-palladium", "ore-crystal", "crystal-cut"];
export const EXCHANGE_RADIUS = 22;

export function ResourceExchange() {
  return (
    <group>
      {EXCHANGE.map((id, i) => {
        const a = (i / EXCHANGE.length) * Math.PI * 2 + Math.PI / EXCHANGE.length;
        return (
          <group key={id} position={[Math.sin(a) * EXCHANGE_RADIUS, 0, Math.cos(a) * EXCHANGE_RADIUS]} rotation={[0, a + Math.PI, 0]}>
            <ItemPedestal id={id} />
          </group>
        );
      })}
      {/* pride of place: the Charged Crystal in front of HQ */}
      <group position={[0, 0, 11]}>
        <ItemPedestal id="crystal-charged" size={1.3} />
      </group>
    </group>
  );
}

/** Pedestal positions as colliders [x, z, radius, height] so players walk around them. */
export function exchangeColliders(): [number, number, number, number][] {
  const out: [number, number, number, number][] = EXCHANGE.map((_, i) => {
    const a = (i / EXCHANGE.length) * Math.PI * 2 + Math.PI / EXCHANGE.length;
    return [Math.sin(a) * EXCHANGE_RADIUS, Math.cos(a) * EXCHANGE_RADIUS, 1.1, 2.2];
  });
  out.push([0, 11, 1.1, 2.6]);
  return out;
}

/** Warm the cache for the Core's items so they appear together. */
export function preloadCoreItems() {
  for (const id of [...EXCHANGE, "crystal-charged" as ItemId]) useGLTF.preload(url(id), false, true);
}
