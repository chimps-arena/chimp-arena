"use client";

/**
 * Asset gallery: every 3D delivery on its own turntable spot, for reviewing
 * models (scale, materials, facing, animations) before they go in-world.
 * Tabs: economy items, environment buildings, rigged characters, pets.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { Html } from "./drei-html";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CHARACTERS, characterById } from "@chimp-arena/shared";
import { ChargedCrystal, ItemModel, ITEMS, type ItemId } from "./items";
import { ENV_IDS, EnvModel, Pet } from "./env-models";
import { GearModel, TOOL_IDS, TOOLS, WEAPON_IDS, WEAPONS } from "./gear";
import { ROVER_IDS, SHIP_IDS, VEHICLES, VehicleModel } from "./vehicles";
import { WorldLighting } from "./world";
import { CharacterBody, ModelIndexContext, type ModelIndex } from "./character-body";
import { idlePose, type PoseInput } from "./chimp-rig";

/** Standing with the rifle up, exactly as players see armed characters in-game. */
const ARMED: PoseInput = { ...idlePose(), armed: true };
const armedPose = () => ARMED;

const ITEM_ORDER: ItemId[] = [
  "ore-gold",
  "ore-cobalt",
  "ore-palladium",
  "ore-crystal",
  "bar-gold",
  "bar-cobalt",
  "bar-palladium",
  "crystal-cut",
  "kit-fuel",
  "kit-charge",
  "kit-drink",
  "kit-food",
  "nutrition-cell",
  "meal",
  "power-bar",
  "drink",
  "drink-canister",
  "crystal-charged-v2",
  "crystal-charged",
];

type Tab = "items" | "weapons" | "tools" | "vehicles" | "buildings" | "characters" | "armed" | "roster" | "pets";
const TABS: Tab[] = ["items", "weapons", "tools", "vehicles", "buildings", "characters", "armed", "roster", "pets"];

type Entry = { key: string; title: string; sub: string; color: string; node: React.ReactNode };

/** A rigged character playing one of its clips, cycled by the buttons. */
function AnimatedCharacter({ file, clip }: { file: string; clip: number }) {
  const gltf = useGLTF(`/models/characters/${file}`, false, true);
  const scene = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    s.updateMatrixWorld(true); // pose the bones first (see character-body.tsx)
    const box = new THREE.Box3().setFromObject(s, true);
    const k = 1.9 / (box.max.y - box.min.y || 1);
    s.scale.setScalar(k);
    s.position.y = -box.min.y * k;
    s.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
    });
    return s;
  }, [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  useEffect(() => {
    const a = actions[names[clip % names.length]];
    a?.reset().fadeIn(0.2).play();
    return () => void a?.fadeOut(0.2);
  }, [actions, names, clip]);
  return <primitive object={scene} />;
}

function Shelf({ entries, cols, gap, hidden }: { entries: Entry[]; cols: number; gap: number; hidden: boolean }) {
  const rows = Math.ceil(entries.length / cols);
  return entries.map((e, i) => {
    const x = ((i % cols) - (cols - 1) / 2) * gap;
    const z = (Math.floor(i / cols) - (rows - 1) / 2) * 3.2;
    return (
      <group key={e.key} position={[x, 0, z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.95, 1.05, 48]} />
          <meshBasicMaterial color={e.color} toneMapped={false} />
        </mesh>
        <Suspense fallback={null}>{e.node}</Suspense>
        <Html position={[0, -0.05, 1.35]} center distanceFactor={9} style={{ pointerEvents: "none", display: hidden ? "none" : undefined }}>
          <div className="whitespace-nowrap text-center text-white">
            <div className="text-[13px] font-bold capitalize">{e.title}</div>
            <div className="text-[9px] uppercase tracking-wider text-white/60">{e.sub}</div>
          </div>
        </Html>
      </group>
    );
  });
}

export function ItemGallery() {
  const [tab, setTab] = useState<Tab>("items");
  const [index, setIndex] = useState<Record<string, { file: string; clips?: string[] }>>({});
  const [clip, setClip] = useState(3); // "Idle" in the team's Mixamo exports

  useEffect(() => {
    fetch("/models/characters/index.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then(setIndex)
      .catch(() => {});
  }, []);

  // Every tab stays mounted and the inactive ones are hidden: unmounting drei
  // <Html> labels mid-render trips a React 19 DOM race.
  const byTab: Record<Tab, Entry[]> = useMemo(() => {
    const items: Entry[] = ITEM_ORDER.map((id) => ({
        key: id,
        title: ITEMS[id].name,
        sub: ITEMS[id].kind,
        color: ITEMS[id].glow,
        node: id === "crystal-charged" ? <ChargedCrystal size={1.8} /> : <ItemModel id={id} size={1.4} />,
      }));
    const buildings: Entry[] = ENV_IDS.map((id) => ({
        key: id,
        title: id.replace(/-/g, " "),
        sub: "Environment",
        color: "#f59e0b",
        node: <EnvModel id={id} fit={/tower/.test(id) ? "height" : "width"} size={/tower/.test(id) ? 3 : 2} />,
      }));
    const characters: Entry[] = Object.entries(index).map(([id, e]) => ({
        key: id,
        title: characterById(id)?.name ?? id,
        sub: e.clips?.[clip % (e.clips.length || 1)] ?? "",
        color: "#a855f7",
        node: <AnimatedCharacter file={e.file} clip={clip} />,
      }));
    // The same characters through the game's own renderer, rifle up.
    const armed: Entry[] = Object.keys(index).map((id) => ({
      key: id,
      title: characterById(id)?.name ?? id,
      sub: "Armed (in-game)",
      color: "#ef4444",
      node: <CharacterBody look={characterById(id)} pose={armedPose} />,
    }));
    const pets: Entry[] = (["astrodog", "astrokitty"] as const).map((id) => ({
      key: id,
      title: id === "astrodog" ? "Astrodog" : "Astrokitty",
      sub: "Companion pet",
      color: "#22d3ee",
      node: <Pet id={id} size={id === "astrodog" ? 0.9 : 0.8} radius={0.6} />,
    }));
    // Weapons and tools float at chest height, slowly turning on the shelf.
    const weapons: Entry[] = WEAPON_IDS.map((id) => ({
      key: id,
      title: WEAPONS[id].name,
      sub: WEAPONS[id].tier,
      color: WEAPONS[id].glow,
      node: (
        <group position={[0, 1, 0]}>
          <GearModel id={id} length={2.2} />
        </group>
      ),
    }));
    const tools: Entry[] = TOOL_IDS.map((id) => ({
      key: id,
      title: TOOLS[id].name,
      sub: TOOLS[id].tier,
      color: TOOLS[id].glow,
      node: (
        <group position={[0, 1, 0]}>
          <GearModel id={id} length={1.8} />
        </group>
      ),
    }));
    // Vehicles at a common display size; a small arrow on the ring marks +z (forward).
    const vehicles: Entry[] = [...ROVER_IDS, ...SHIP_IDS].map((id) => ({
      key: id,
      title: VEHICLES[id].name,
      sub: VEHICLES[id].kind,
      color: VEHICLES[id].glow,
      node: (
        <group>
          <VehicleModel id={id} length={2.4} />
          <mesh position={[0, 0.02, 1.25]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 3]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      ),
    }));
    // Every roster character as players see them (real model if switched on, else the stand-in).
    const roster: Entry[] = CHARACTERS.map((c) => ({
      key: c.id,
      title: c.name,
      sub: index[c.id] ? "3D model" : "Stand-in",
      color: index[c.id] ? "#22c55e" : "#64748b",
      node: <CharacterBody look={c} pose={idlePose} />,
    }));
    return { items, weapons, tools, vehicles, buildings, characters, armed, roster, pets };
  }, [index, clip]);

  return (
    <div className="relative h-[calc(100dvh-140px)] min-h-[480px] w-full overflow-hidden rounded-xl border border-violet-500/30 bg-[#120c2a]">
      <Canvas camera={{ fov: 40, position: [0, 6.5, 13] }} dpr={[1, 1.6]} gl={{ toneMappingExposure: 1.15 }}
        onCreated={({ scene }) => {
          if (process.env.NODE_ENV !== "production") (window as unknown as { __galScene: unknown }).__galScene = scene;
        }}
      >
        <color attach="background" args={["#1a1238"]} />
        <WorldLighting />
        <ModelIndexContext.Provider value={index as ModelIndex}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <circleGeometry args={[30, 64]} />
          <meshStandardMaterial color="#3b3552" metalness={0.3} roughness={0.5} />
        </mesh>
        {TABS.map((t) => (
          <group key={t} visible={t === tab}>
            <Shelf entries={byTab[t]} cols={t === "roster" ? 10 : t === "characters" || t === "armed" || t === "buildings" || t === "vehicles" ? 6 : t === "weapons" ? 3 : 5} gap={t === "characters" || t === "armed" || t === "roster" ? 2.2 : t === "buildings" || t === "vehicles" ? 3.4 : t === "weapons" ? 3.6 : 3} hidden={t !== tab} />
          </group>
        ))}
        </ModelIndexContext.Provider>
        <OrbitControls target={[0, 0.6, 0]} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>

      <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-3 py-2 text-xs text-white">
        <div className="font-bold uppercase tracking-wider text-amber-300">Astroworld asset gallery</div>
        <div className="text-white/60">Drag to orbit · scroll to zoom</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1 font-semibold capitalize ${tab === t ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "characters" && (
          <button type="button" onClick={() => setClip((c) => c + 1)} className="mt-2 rounded bg-violet-500 px-2 py-1 font-semibold hover:bg-violet-400">
            Next animation
          </button>
        )}
      </div>
    </div>
  );
}
