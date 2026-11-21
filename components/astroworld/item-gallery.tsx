"use client";

/**
 * Item gallery: every economy item model on its own turntable, for reviewing
 * deliveries (scale, materials, the charge effect) before they go in-world.
 */

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { ChargedCrystal, ItemModel, ITEMS, type ItemId } from "./items";
import { WorldLighting } from "./world";

const ORDER: ItemId[] = [
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
  "crystal-charged",
];

export function ItemGallery() {
  const cols = 5;
  return (
    <div className="relative h-[calc(100dvh-140px)] min-h-[480px] w-full overflow-hidden rounded-xl border border-violet-500/30 bg-[#120c2a]">
      <Canvas camera={{ fov: 40, position: [0, 6.5, 13] }} dpr={[1, 1.6]} gl={{ toneMappingExposure: 1.15 }}>
        <color attach="background" args={["#1a1238"]} />
        <WorldLighting />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <circleGeometry args={[30, 64]} />
          <meshStandardMaterial color="#3b3552" metalness={0.3} roughness={0.5} />
        </mesh>
        {ORDER.map((id, i) => {
          const x = ((i % cols) - (cols - 1) / 2) * 3;
          const z = (Math.floor(i / cols) - 1) * 3.2;
          const item = ITEMS[id];
          return (
            <group key={id} position={[x, 0, z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[0.95, 1.05, 48]} />
                <meshBasicMaterial color={item.glow} toneMapped={false} />
              </mesh>
              <Suspense fallback={null}>{id === "crystal-charged" ? <ChargedCrystal size={1.8} /> : <ItemModel id={id} size={1.4} />}</Suspense>
              <Html position={[0, -0.05, 1.35]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
                <div className="whitespace-nowrap text-center text-white">
                  <div className="text-[13px] font-bold">{item.name}</div>
                  <div className="text-[9px] uppercase tracking-wider text-white/60">{item.kind}</div>
                </div>
              </Html>
            </group>
          );
        })}
        <OrbitControls target={[0, 0.6, 0]} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/60 px-3 py-2 text-xs text-white">
        <div className="font-bold uppercase tracking-wider text-amber-300">Astroworld item gallery</div>
        <div className="text-white/60">Drag to orbit · scroll to zoom</div>
      </div>
    </div>
  );
}
