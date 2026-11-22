"use client";

/**
 * The full world map (M): districts, every property (hover for its name, owner
 * or price), starports, newsstands, landmarks, NPCs and players, and you.
 * Same orientation as the corner minimap (+x right, +z up).
 */

import { memo, useEffect, useState } from "react";
import { CORE_RING, DISTRICTS, LOT_SPACING, ROAD_ANGLES, SAFE_RADIUS, STARPORTS, WORLD_RADIUS, type Placement } from "@chimp-arena/shared";
import type { WorldProperty } from "./buildings";
import { NEWS_SPOTS } from "./news";
import { ASTROBURGER } from "./astroburger";

const SIZE = 1000;
const K = SIZE / 2 / (WORLD_RADIUS + 20);
const X = (x: number) => SIZE / 2 + x * K;
const Z = (z: number) => SIZE / 2 - z * K;
const DISTRICT_HALF = LOT_SPACING * 3.6;

/** Fixed landmarks in the Core (positions mirror world.tsx and hub-scene). */
const LANDMARKS: { name: string; x: number; z: number; color: string; icon: string }[] = [
  { name: "Astrocorp HQ", x: 0, z: 0, color: "#a855f7", icon: "♛" },
  { name: "Rover Showroom", x: 26, z: -14, color: "#f5b301", icon: "🚙" },
  { name: "Astroburger", x: ASTROBURGER.x, z: ASTROBURGER.z, color: "#e879f9", icon: "🍔" },
];

interface MapPlayer {
  id: string;
  name: string;
  x: number;
  z: number;
  ry: number;
}

const Base = memo(function Base({ props, places }: { props: WorldProperty[]; places: Map<string, Placement> }) {
  return (
    <g>
      {/* world disc, roads, safe zone */}
      <circle cx={SIZE / 2} cy={SIZE / 2} r={WORLD_RADIUS * K} fill="#1d1730" stroke="#3b3552" strokeWidth={2} />
      {ROAD_ANGLES.map((a, i) => {
        const d = DISTRICTS[i];
        const end = Math.hypot(d.x, d.z) - DISTRICT_HALF;
        return (
          <line
            key={a}
            x1={X(Math.sin(a) * SAFE_RADIUS)}
            y1={Z(Math.cos(a) * SAFE_RADIUS)}
            x2={X(Math.sin(a) * end)}
            y2={Z(Math.cos(a) * end)}
            stroke="#4a4462"
            strokeWidth={12 * K + 3}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={SIZE / 2} cy={SIZE / 2} r={SAFE_RADIUS * K} fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth={2} strokeDasharray="6 4" />
      <circle cx={SIZE / 2} cy={SIZE / 2} r={CORE_RING * K} fill="none" stroke="#a855f7" strokeOpacity={0.25} strokeWidth={1} />
      {DISTRICTS.map((d) => (
        <g key={d.zone}>
          <rect
            x={X(d.x - DISTRICT_HALF)}
            y={Z(d.z + DISTRICT_HALF)}
            width={DISTRICT_HALF * 2 * K}
            height={DISTRICT_HALF * 2 * K}
            fill="rgba(239,68,68,0.08)"
            stroke={d.accent}
            strokeWidth={2}
            rx={6}
          />
          <text x={X(d.x)} y={Z(d.z + DISTRICT_HALF) - 10} textAnchor="middle" fill={d.accent} fontSize={22} fontWeight={800} letterSpacing={2}>
            {d.zone.toUpperCase()}
          </text>
          <text x={X(d.x)} y={Z(d.z + DISTRICT_HALF) + 16} textAnchor="middle" fill="#f87171" fontSize={11} letterSpacing={2}>
            COMBAT ZONE
          </text>
        </g>
      ))}
      <text x={SIZE / 2} y={Z(SAFE_RADIUS) - 8} textAnchor="middle" fill="#34d399" fontSize={18} fontWeight={800} letterSpacing={2}>
        ASTROWORLD CORE · SAFE ZONE
      </text>
      {/* properties */}
      {props.map((p) => {
        const at = places.get(p.id);
        if (!at) return null;
        return (
          <rect
            key={p.id}
            data-prop={p.id}
            x={X(at.x) - 5}
            y={Z(at.z) - 5}
            width={10}
            height={10}
            rx={2}
            fill={p.forSale ? "#10b981" : "#f59e0b"}
            stroke="#0b0812"
            strokeWidth={1}
            className="cursor-pointer"
          />
        );
      })}
      {/* starports, newsstands, landmarks */}
      {STARPORTS.map((s) => (
        <g key={s.id} transform={`translate(${X(s.x)} ${Z(s.z)})`}>
          <circle r={11} fill="#0e2a33" stroke="#22d3ee" strokeWidth={2} />
          <text y={5} textAnchor="middle" fontSize={13}>
            🚀
          </text>
        </g>
      ))}
      {NEWS_SPOTS.map((n) => (
        <g key={n.key} transform={`translate(${X(n.x)} ${Z(n.z)})`}>
          <rect x={-8} y={-8} width={16} height={16} rx={3} fill="#3b0a14" stroke="#ef4444" strokeWidth={1.5} />
          <text y={4} textAnchor="middle" fontSize={10}>
            📰
          </text>
        </g>
      ))}
      {LANDMARKS.map((l) => (
        <g key={l.name} transform={`translate(${X(l.x)} ${Z(l.z)})`}>
          <circle r={12} fill="#1a0f2e" stroke={l.color} strokeWidth={2} />
          <text y={5} textAnchor="middle" fontSize={13} fill={l.color}>
            {l.icon}
          </text>
        </g>
      ))}
    </g>
  );
});

export function WorldMap({
  props,
  places,
  players,
  npcs,
  meId,
  onClose,
  hideout,
}: {
  props: WorldProperty[];
  places: Map<string, Placement>;
  players: MapPlayer[];
  npcs: { name: string; x: number; z: number; story?: boolean }[];
  /** Tommy's hideout, once the story has revealed it. */
  hideout?: { x: number; z: number } | null;
  meId: string | null;
  onClose: () => void;
}) {
  const [hover, setHover] = useState<WorldProperty | null>(null);
  useEffect(() => {
    document.exitPointerLock?.();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "m" || e.key === "M") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const byId = new Map(props.map((p) => [p.id, p]));
  const me = players.find((p) => p.id === meId);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-full max-h-full w-full max-w-5xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between text-white">
          <div className="text-sm font-black uppercase tracking-wider text-amber-300">Astroworld · map</div>
          <button type="button" onClick={onClose} className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20">
            Close <span className="text-white/50">(M / Esc)</span>
          </button>
        </div>
        <div className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-white/80">
          <span>
            <span className="text-amber-300">▲</span> You
          </span>
          <span>
            <span className="text-violet-400">●</span> Players
          </span>
          <span>
            <span className="text-amber-400">●</span> NPCs
          </span>
          <span>
            <span className="text-fuchsia-400">●</span> Story
          </span>
          <span>
            <span className="text-emerald-400">■</span> For sale
          </span>
          <span>
            <span className="text-amber-500">■</span> Owned
          </span>
          <span>🚀 Starport (fly anywhere)</span>
          <span>📰 Astro-News</span>
          <span>🍔 Astroburger</span>
          <span>🚙 Rover Showroom</span>
          <span>♛ Astrocorp HQ</span>
        </div>
        <div className="relative min-h-0 flex-1">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto h-full w-auto max-w-full"
            onMouseMove={(e) => {
              const id = (e.target as Element).getAttribute?.("data-prop");
              setHover(id ? (byId.get(id) ?? null) : null);
            }}
          >
            <Base props={props} places={places} />
            {npcs.map((n, i) =>
              n.story ? (
                <g key={i} transform={`translate(${X(n.x)} ${Z(n.z)})`}>
                  <circle r={11} fill="rgba(232,121,249,0.25)" />
                  <circle r={6} fill="#e879f9" stroke="#fff" strokeWidth={1.5}>
                    <title>{n.name} (story)</title>
                  </circle>
                  <text y={-14} textAnchor="middle" fill="#f0abfc" fontSize={13} fontWeight={700}>
                    {n.name}
                  </text>
                </g>
              ) : (
                <circle key={i} cx={X(n.x)} cy={Z(n.z)} r={4} fill="#fbbf24" stroke="#000" strokeWidth={1}>
                  <title>{n.name}</title>
                </circle>
              ),
            )}
            {hideout && (
              <g transform={`translate(${X(hideout.x)} ${Z(hideout.z)})`}>
                <circle r={16} fill="none" stroke="#e879f9" strokeWidth={2} strokeDasharray="4 3" />
                <text y={5} textAnchor="middle" fontSize={15}>
                  ✖
                </text>
                <text y={30} textAnchor="middle" fill="#f0abfc" fontSize={13} fontWeight={700}>
                  The hideout
                </text>
              </g>
            )}
            {players
              .filter((p) => p.id !== meId)
              .map((p) => (
                <circle key={p.id} cx={X(p.x)} cy={Z(p.z)} r={5} fill="#a855f7" stroke="#fff" strokeWidth={1}>
                  <title>{p.name}</title>
                </circle>
              ))}
            {me && (
              <g transform={`translate(${X(me.x)} ${Z(me.z)}) rotate(${(-me.ry * 180) / Math.PI + 180})`}>
                <circle r={16} fill="rgba(251,191,36,0.2)" />
                <path d="M0,-13 L9,10 L0,5 L-9,10 Z" fill="#fbbf24" stroke="#000" strokeWidth={1.5} />
              </g>
            )}
          </svg>
          {hover && (
            <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-white/20 bg-black/85 px-3 py-2 text-white">
              <div className="font-bold">{hover.name}</div>
              <div className="text-[11px] uppercase tracking-wider text-white/60">
                {hover.type.replace(/_/g, " ")} · {hover.zone}
              </div>
              <div className={`text-xs ${hover.forSale ? "text-emerald-300" : "text-amber-200"}`}>
                {hover.forSale ? `For sale · ${hover.priceChimp.toLocaleString()} $CHIMP` : `Owned by ${hover.ownerHandle}`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
