"use client";

/**
 * Life along the roads between the Core and the districts: a waystation
 * halfway (comms mast, cargo, fuel), wreckage, and direction signs, so the
 * long drive out has landmarks and you always know where you're heading.
 */

import { Suspense } from "react";
import { Html } from "./drei-html";
import { DISTRICTS, LOT_SPACING, ROAD_ANGLES, SAFE_RADIUS, type Cover } from "@chimp-arena/shared";
import { EnvModel, type EnvId, type Fit } from "./env-models";

const DISTRICT_HALF = LOT_SPACING * 3.6;

interface Prop {
  id: EnvId;
  fit?: Fit;
  size: number;
  /** Distance from the Core along the road, metres. */
  along: number;
  /** Sideways from the road's centre line (+ = right when heading out). */
  side: number;
  ry: number;
}

/** The same dressing on every road, at fractions of the open stretch. */
function roadProps(start: number, end: number): Prop[] {
  const at = (f: number) => start + (end - start) * f;
  return [
    // Waystation, halfway: comms mast, cargo stack, fuel.
    { id: "basic-comms-tower", fit: "height", size: 14, along: at(0.5), side: 15, ry: 0 },
    { id: "cargo-box", size: 6, along: at(0.5) - 5, side: 13, ry: 0.4 },
    { id: "cargo-box", size: 6, along: at(0.5) + 4, side: 19, ry: -0.2 },
    { id: "fuel-tank-2", fit: "height", size: 7, along: at(0.5) + 2, side: -15, ry: 0 },
    { id: "fuel-tank-4", size: 6, along: at(0.5) - 6, side: -16, ry: 1.2 },
    // A stripped outpost a quarter of the way out, a bunker three quarters.
    { id: "outpost", size: 10, along: at(0.22), side: -20, ry: Math.PI / 2 },
    { id: "bunker", size: 9, along: at(0.78), side: 19, ry: -Math.PI / 2 },
  ];
}

const span = (i: number) => {
  const d = DISTRICTS[i];
  return { start: SAFE_RADIUS + 6, end: Math.hypot(d.x, d.z) - DISTRICT_HALF - 4 };
};

function place(a: number, along: number, side: number): [number, number] {
  // Road heading a: forward = (sin a, cos a), right = (cos a, -sin a).
  return [Math.sin(a) * along + Math.cos(a) * side, Math.cos(a) * along - Math.sin(a) * side];
}

/** Walk-around colliders for the roadside props. */
export const ROADSIDE_COVERS: Cover[] = ROAD_ANGLES.flatMap((a, i) => {
  const { start, end } = span(i);
  return roadProps(start, end).map((p): Cover => {
    const [x, z] = place(a, p.along, p.side);
    return [x, z, p.size * 0.45, p.fit === "height" ? p.size : p.size * 0.7];
  });
});

function Signpost({ a, along, lines }: { a: number; along: number; lines: { text: string; color: string }[] }) {
  const [x, z] = place(a, along, -8);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 3.2, 8]} />
        <meshStandardMaterial color="#2a2638" metalness={0.7} roughness={0.3} />
      </mesh>
      <Html position={[0, 3.6, 0]} center distanceFactor={20} zIndexRange={[3, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded border border-white/30 bg-black/80 px-2 py-1 text-[11px] font-bold uppercase tracking-wider">
          {lines.map((l) => (
            <div key={l.text} style={{ color: l.color }}>
              {l.text}
            </div>
          ))}
        </div>
      </Html>
    </group>
  );
}

export function Roadside() {
  return (
    <group>
      {ROAD_ANGLES.map((a, i) => {
        const d = DISTRICTS[i];
        const { start, end } = span(i);
        const toDistrict = (along: number) => Math.round(Math.hypot(d.x, d.z) - DISTRICT_HALF - along);
        return (
          <group key={a}>
            {roadProps(start, end).map((p, k) => {
              const [x, z] = place(a, p.along, p.side);
              return (
                <group key={k} position={[x, 0, z]} rotation={[0, a + p.ry, 0]}>
                  <Suspense fallback={null}>
                    <EnvModel id={p.id} fit={p.fit} size={p.size} />
                  </Suspense>
                </group>
              );
            })}
            {/* Leaving the Core, and at the waystation: where this road goes and how far. */}
            {[start + 14, start + (end - start) * 0.5].map((along) => (
              <Signpost
                key={along}
                a={a}
                along={along}
                lines={[
                  { text: `↑ ${d.zone} · ${toDistrict(along)} m`, color: d.accent },
                  { text: `↓ Astroworld Core · ${Math.round(along - SAFE_RADIUS)} m`, color: "#34d399" },
                ]}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}
