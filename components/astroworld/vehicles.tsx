"use client";

/**
 * The team's vehicle kits: four rovers and eight spaceships, optimized into
 * public/models/vehicles (scripts/vehicle-models.manifest.json).
 *
 * Every model is turned so its nose points along +z (the game's "forward")
 * using a per-model yaw, then scaled to a real-world length.
 */

import { Suspense, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export type RoverId = "rover-terra-explorer" | "rover-apex-r" | "rover-aurora" | "rover-warlord";
export type ShipId =
  | "ship-pioneer"
  | "ship-starliner"
  | "ship-agena"
  | "ship-titan"
  | "ship-atlas"
  | "ship-dreadnought"
  | "ship-vanguard"
  | "ship-rebel-raider";
export type VehicleId = RoverId | ShipId;

interface VehicleInfo {
  name: string;
  kind: string;
  /** Real-world length, metres. */
  length: number;
  /** Extra yaw so the model's nose faces +z (the team's exports all face -x). */
  yaw: number;
  glow: string;
}

export const VEHICLES: Record<VehicleId, VehicleInfo> = {
  "rover-terra-explorer": { name: "Terra-Explorer", kind: "Base Rover", length: 4.6, yaw: Math.PI / 2, glow: "#94a3b8" },
  "rover-apex-r": { name: "Apex-R", kind: "Racing Rover", length: 4.8, yaw: Math.PI / 2, glow: "#ef4444" },
  "rover-aurora": { name: "Aurora", kind: "Luxury Rover", length: 5.2, yaw: Math.PI / 2, glow: "#f5b301" },
  "rover-warlord": { name: "Warlord", kind: "Assault Rover", length: 5.6, yaw: Math.PI / 2, glow: "#22c55e" },
  "ship-pioneer": { name: "Pioneer", kind: "Base Transport", length: 22, yaw: Math.PI / 2, glow: "#94a3b8" },
  "ship-starliner": { name: "Starliner", kind: "Mega Transport", length: 60, yaw: Math.PI / 2, glow: "#38bdf8" },
  "ship-agena": { name: "Agena", kind: "Luxury Sports Spaceship", length: 16, yaw: Math.PI / 2, glow: "#f5b301" },
  "ship-titan": { name: "Titan", kind: "Heavy Ore Transport", length: 45, yaw: Math.PI / 2, glow: "#f97316" },
  "ship-atlas": { name: "Atlas", kind: "Light Ore Transport", length: 26, yaw: Math.PI / 2, glow: "#eab308" },
  "ship-dreadnought": { name: "Dreadnought", kind: "Heavy Battleship", length: 140, yaw: Math.PI / 2, glow: "#ef4444" },
  "ship-vanguard": { name: "Vanguard", kind: "Light Battleship", length: 55, yaw: Math.PI / 2, glow: "#a855f7" },
  "ship-rebel-raider": { name: "The Rebel Raider", kind: "Rebel Ship", length: 24, yaw: Math.PI / 2, glow: "#ec4899" },
};

export const ROVER_IDS: RoverId[] = ["rover-terra-explorer", "rover-apex-r", "rover-aurora", "rover-warlord"];
export const SHIP_IDS = (Object.keys(VEHICLES) as VehicleId[]).filter((id): id is ShipId => id.startsWith("ship-"));

const vehicleUrl = (id: VehicleId) => `/models/vehicles/${id}.glb`;

/**
 * A vehicle scaled to `length` metres (default: its real length), nose along
 * +z, wheels/landing gear on y=0, centred.
 */
export function VehicleModel({ id, length }: { id: VehicleId; length?: number }) {
  const gltf = useGLTF(vehicleUrl(id), false, true);
  const info = VEHICLES[id];
  const size = length ?? info.length;
  const model = useMemo(() => {
    const inner = gltf.scene.clone(true);
    const turn = new THREE.Group();
    turn.rotation.y = info.yaw;
    turn.add(inner);
    turn.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(turn);
    const d = box.getSize(new THREE.Vector3());
    const k = size / Math.max(d.x, d.z, 1e-6);
    const c = box.getCenter(new THREE.Vector3());
    const outer = new THREE.Group();
    turn.position.set(-c.x, -box.min.y, -c.z);
    outer.add(turn);
    outer.scale.setScalar(k);
    return outer;
  }, [gltf.scene, info.yaw, size]);
  return <primitive object={model} />;
}

export function preloadVehicles(ids: VehicleId[]) {
  for (const id of ids) useGLTF.preload(vehicleUrl(id), false, true);
}

/**
 * The rover players drive (F): the team's Terra-Explorer. The driver rides
 * inside, so the character is hidden while driving. `fallback` (the
 * code-built rover) shows while the model downloads.
 */
export function DrivenRover({ fallback }: { fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <VehicleModel id="rover-terra-explorer" />
    </Suspense>
  );
}

/* ------------------------------ showroom ------------------------------ */

/** The showroom's turntable star (the luxury Aurora), code rover while loading. */
export function ShowroomStar({ fallback }: { fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <VehicleModel id="rover-aurora" />
    </Suspense>
  );
}

/** Rovers parked beside the showroom pad, angled toward the plaza. */
export function ShowroomLot() {
  const parked: { id: RoverId; at: [number, number]; ry: number }[] = [
    { id: "rover-apex-r", at: [-7.5, 2], ry: -2.3 },
    { id: "rover-warlord", at: [7.5, 2], ry: 2.3 },
    { id: "rover-terra-explorer", at: [0, -7.5], ry: Math.PI },
  ];
  return (
    <>
      {parked.map((p) => (
        <group key={p.id} position={[p.at[0], 0, p.at[1]]} rotation={[0, p.ry, 0]}>
          <Suspense fallback={null}>
            <VehicleModel id={p.id} />
          </Suspense>
        </group>
      ))}
    </>
  );
}

/* ------------------------------ sky traffic ------------------------------ */

/**
 * Ships in the sky on fixed loops. Positions come from wall-clock time, so
 * every player sees the same ship in the same place.
 */
interface Flight {
  id: ShipId;
  /** Loop centre (x, z), radii (x, z), height, seconds per lap, direction. */
  c: [number, number];
  r: [number, number];
  y: number;
  period: number;
  dir: 1 | -1;
  phase: number;
}

const FLIGHTS: Flight[] = [
  // The Astrocorp flagship on a slow, high patrol around the whole map.
  { id: "ship-dreadnought", c: [0, 0], r: [420, 420], y: 150, period: 600, dir: 1, phase: 0 },
  // Its escort, a little behind and below.
  { id: "ship-vanguard", c: [0, 0], r: [380, 380], y: 120, period: 600, dir: 1, phase: -0.035 },
  // Ore runs between the Belt and Helios Docks.
  { id: "ship-titan", c: [-90, 50], r: [170, 110], y: 70, period: 160, dir: -1, phase: 0.3 },
  { id: "ship-atlas", c: [-90, 50], r: [170, 110], y: 55, period: 160, dir: -1, phase: 0.8 },
  // Passenger liner over the Core and Lunar Rim.
  { id: "ship-starliner", c: [80, -30], r: [200, 140], y: 95, period: 240, dir: 1, phase: 0.5 },
  // A rebel raider skimming the outskirts, fast and low.
  { id: "ship-rebel-raider", c: [0, 0], r: [300, 260], y: 38, period: 70, dir: -1, phase: 0.2 },
];

function placeFlight(g: THREE.Group | null, f: Flight) {
  if (!g) return;
  const t = Date.now() / 1000;
  const a = (t / f.period + f.phase) * Math.PI * 2 * f.dir;
  const x = f.c[0] + Math.sin(a) * f.r[0];
  const z = f.c[1] + Math.cos(a) * f.r[1];
  // Heading: along the loop's tangent.
  const dx = Math.cos(a) * f.r[0] * f.dir;
  const dz = -Math.sin(a) * f.r[1] * f.dir;
  g.position.set(x, f.y + Math.sin(t * 0.4 + f.phase * 10) * 2, z);
  g.rotation.set(0, Math.atan2(dx, dz), -0.08 * f.dir);
}

function FlyingShip({ f }: { f: Flight }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => placeFlight(g.current, f));
  return (
    <group ref={g}>
      <Suspense fallback={null}>
        <VehicleModel id={f.id} />
      </Suspense>
    </group>
  );
}

export function SkyTraffic() {
  return (
    <>
      {FLIGHTS.map((f) => (
        <FlyingShip key={f.id} f={f} />
      ))}
    </>
  );
}

/* ------------------------------ docked ships ------------------------------ */

const DOCKED: ShipId[] = ["ship-agena", "ship-pioneer", "ship-atlas", "ship-agena", "ship-pioneer", "ship-titan"];

/** Ship for a dock lot: a smaller craft hovering over its landing stand. */
export function dockedShipFor(propertyId: string): ShipId {
  let h = 0;
  for (const c of propertyId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return DOCKED[Math.abs(h) % DOCKED.length];
}

export function DockedShip({ id }: { id: ShipId }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = 11 + Math.sin(clock.elapsedTime * 0.8) * 0.4;
  });
  return (
    <group ref={g}>
      <Suspense fallback={null}>
        <VehicleModel id={id} length={Math.min(VEHICLES[id].length, 20)} />
      </Suspense>
    </group>
  );
}
