"use client";

/**
 * Starports: landing pads with a ship you can board (E) to fly to another
 * starport - the Core and each district. Helios Docks' docked ships are
 * boardable too (registered in property-panel.tsx). The server checks you're
 * really at a ship and moves you; the flight itself is a short cut-scene.
 */

import { Suspense, useEffect } from "react";
import { Html } from "./drei-html";
import * as THREE from "three";
import { STARPORTS, type Cover, type Starport } from "@chimp-arena/shared";
import { endTalk, npcSpec, registerInteractable, type NpcSpec } from "./npcs";
import { VehicleModel, VEHICLES, type ShipId } from "./vehicles";

/** The ship waiting at each starport. */
const PORT_SHIP: Record<string, ShipId> = { core: "ship-agena" };
const shipAt = (port: Starport): ShipId => PORT_SHIP[port.id] ?? "ship-pioneer";

/** Each pad's ship blocks walking (you board it with E, not by walking in). */
export const STARPORT_COVERS: Cover[] = STARPORTS.map((p) => [p.x, p.z, 6.5, 6]);

const padMat = new THREE.MeshStandardMaterial({ color: "#3b3552", metalness: 0.6, roughness: 0.35 });
const lineMat = new THREE.MeshBasicMaterial({ color: "#22d3ee", toneMapped: false });

const portSpec = (port: Starport): NpcSpec => ({
  key: `port:${port.id}`,
  characterId: "",
  role: `Starport · ${port.name}`,
  title: `the ${VEHICLES[shipAt(port)].name}`,
  kind: "port",
  portId: port.id,
  range: 13,
  route: { kind: "post", at: [port.x, port.z], face: port.ry },
  speed: 0,
  phase: 0,
});

function StarportPad({ port }: { port: Starport }) {
  useEffect(() => registerInteractable(portSpec(port), port.x, port.z), [port]);
  const ship = shipAt(port);
  return (
    <group position={[port.x, 0, port.z]} rotation={[0, port.ry, 0]}>
      <mesh material={padMat} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[11, 11.5, 0.24, 8]} />
      </mesh>
      <mesh material={lineMat} position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[9.6, 10, 8]} />
      </mesh>
      <mesh material={lineMat} position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.2, 3.5, 32]} />
      </mesh>
      <group position={[0, 0.25, 0]}>
        <Suspense fallback={null}>
          <VehicleModel id={ship} length={Math.min(VEHICLES[ship].length, 18)} />
        </Suspense>
      </group>
      <pointLight position={[0, 8, 0]} color="#22d3ee" intensity={30} distance={22} />
      <Html position={[0, 9.5, 0]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded border border-cyan-400/70 bg-black/75 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-cyan-300">
          Starport · {port.name}
          <div className="text-[9px] font-normal normal-case text-white/70">Press E by the ship to fly anywhere</div>
        </div>
      </Html>
    </group>
  );
}

export function Starports() {
  return (
    <>
      {STARPORTS.map((p) => (
        <StarportPad key={p.id} port={p} />
      ))}
    </>
  );
}

/* ------------------------------ boarding UI ------------------------------ */

/** Pick a destination; the server flies you there (or ignores you if you're not at a ship). */
export function TravelPanel({ portKey, onTravel }: { portKey: string; onTravel: (to: string) => void }) {
  const spec = npcSpec(portKey);
  const here = spec?.portId;
  useEffect(() => {
    document.exitPointerLock?.();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTalk();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const destinations = STARPORTS.filter((p) => p.id !== here);
  return (
    <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-3">
      <div className="w-full max-w-md rounded-xl border border-cyan-400/50 bg-black/85 p-4 text-white shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-lg font-bold">Board {spec?.title ?? "the ship"}</div>
            <div className="text-[11px] uppercase tracking-wider text-cyan-300">{spec?.role ?? "Starport"}</div>
          </div>
          <button type="button" onClick={endTalk} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
            Close <span className="text-white/50">(Esc)</span>
          </button>
        </div>
        <div className="mt-3 text-sm text-white/70">Where to?</div>
        <div className="mt-2 grid gap-2">
          {destinations.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onTravel(d.id)}
              className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-left text-sm font-semibold hover:bg-cyan-400/25"
            >
              Fly to {d.name}
              <span className="ml-2 text-xs font-normal text-white/50">{d.id === "core" ? "safe zone" : "combat zone"}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-white/40">Free while Astroworld is in testing.</div>
      </div>
    </div>
  );
}

/** Full-screen flight cut-scene while you travel. */
export function FlightOverlay({ to, since }: { to: string; since: number }) {
  const t = since / 2600;
  if (t >= 1) return null;
  const opacity = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
      style={{ opacity, background: "radial-gradient(ellipse at center, #2a1458 0%, #0a0618 70%)" }}
    >
      <div className="text-center text-white">
        <div className="text-xs uppercase tracking-[0.4em] text-cyan-300">In flight</div>
        <div className="mt-2 text-3xl font-black">Flying to {to}…</div>
      </div>
    </div>
  );
}
