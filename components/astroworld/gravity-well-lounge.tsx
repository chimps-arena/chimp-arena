"use client";

/**
 * Gravity Well Lounge (core-gravity-well): the Meshy model built from the
 * property's NFT art, plus its exact signs, the ring of glowing orb lamps over
 * the round bar, and real lights. Checklist: docs/property-details/gravity-well-lounge.md.
 *
 * Coordinates are metres in the building's own space: centred on x/z, base on
 * y=0, front facing +z, scaled to WIDTH across (see hero-model.tsx). Positions
 * were measured from /astroworld/model-preview?m=gravity&ortho=1 and the
 * model's vertices; re-measure if the model changes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HeroModel } from "./hero-model";
import { CollectionBottles, type ShelfLayout } from "./neon-cantina-bottles";
import { loadCrown, stoolSkin } from "./neon-cantina-signs";
import { wetTiles } from "./neon-cantina";
import { crownPanel, leftSign, mainSign, menuScreen, rightSign, windowCrown, windowSign } from "./gravity-well-signs";
import { ModelErrorBoundary } from "./model-error-boundary";

export const GRAVITY_WELL_URL = "/models/env/gravity-well.glb";
export const WIDTH = 12;

type Spot = { at: [number, number, number]; size: [number, number]; ry?: number };

export const LAYOUT = {
  main: { at: [-3.62, 4.63, 1.58], size: [2.94, 0.86] } as Spot, // ends at x -2.15: the frame and the tall sign's pillar stand proud of it
  right: { at: [-1.12, 3.9, 1.93], size: [0.8, 2.4] } as Spot,
  left: { at: [-5.67, 2.85, 1.2], size: [0.56, 2.0] } as Spot,
  menu: { at: [-1.98, 3.05, 0.42], size: [0.7, 0.85] } as Spot, // on the screen slab left of the tall sign, as in the art
  backCrown: { at: [-4.45, 3.2, -1.78], size: [0.6, 0.6] } as Spot, // top of the back bar, beside the One of Ones
  windowCrown: { at: [2.87, 2.75, 2.12], size: [1.25, 1.25] } as Spot,
  windowSign: { at: [4.52, 2.7, 2.33], size: [0.7, 1.15] } as Spot,
};

/** The round bar and the ring of orb lamps above it (measured). */
const BAR = { x: -3.5, z: -0.15, top: 1.7, ceiling: 3.55 };
const ORB_COLOURS = ["#ff7a2a", "#ffb347", "#6f7bff", "#ff6f9e", "#d65cff", "#ff9a3c", "#8a6bff", "#ff5fc8"];

function neon(hex: string, k: number) {
  const m = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });
  m.color.multiplyScalar(k);
  return m;
}
const RING = new THREE.MeshStandardMaterial({ color: "#3a2d33", metalness: 0.85, roughness: 0.35 });
const RING_GLOW = neon("#ffb04a", 1.6);
const CHAIN = new THREE.MeshStandardMaterial({ color: "#2a2228", metalness: 0.9, roughness: 0.4 });
// Thin, faintly tinted glass: a highlight, without washing the coloured glow to pastel.
const GLASS = new THREE.MeshStandardMaterial({ color: "#2a2433", roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 0.9 });

/** Round-bottomed flask profile (radius, height), neck up. */
const FLASK = [[0, 0], [0.07, 0.008], [0.12, 0.05], [0.14, 0.12], [0.125, 0.2], [0.07, 0.25], [0.035, 0.27], [0.035, 0.34], [0.045, 0.35], [0, 0.35]].map(([a, b]) => new THREE.Vector2(a, b));

/** The signature piece: a ring lit warm underneath with glowing flask lamps on chains. */
function OrbRing() {
  const R = 1.25;
  const ringY = BAR.ceiling - 0.15;
  const flask = useMemo(() => new THREE.LatheGeometry(FLASK, 20), []);
  const liquids = useMemo(() => ORB_COLOURS.map((c) => neon(c, 1.9)), []);
  useEffect(() => () => { flask.dispose(); liquids.forEach((m) => m.dispose()); }, [flask, liquids]);
  const group = useRef<THREE.Group>(null);
  // A slow sway, as if the station's gravity is not quite steady.
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      if (c.userData.orb) c.rotation.z = Math.sin(clock.elapsedTime * 0.6 + i) * 0.035;
    });
  });
  return (
    <group position={[BAR.x, 0, BAR.z]} ref={group}>
      <mesh position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} material={RING}>
        <torusGeometry args={[R, 0.07, 10, 64]} />
      </mesh>
      <mesh position={[0, ringY - 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} material={RING_GLOW}>
        <torusGeometry args={[R, 0.028, 8, 64]} />
      </mesh>
      {ORB_COLOURS.map((_, i) => {
        const a = (i / ORB_COLOURS.length) * Math.PI * 2 + 0.3;
        const drop = 0.35 + (i % 3) * 0.22; // staggered heights, like the art
        const top = ringY - 0.05;
        return (
          <group key={i} position={[Math.sin(a) * R, top, Math.cos(a) * R]} userData={{ orb: true }}>
            <mesh position={[0, -drop / 2, 0]} material={CHAIN}>
              <cylinderGeometry args={[0.006, 0.006, drop, 4]} />
            </mesh>
            {/* flask hangs neck-up from the chain; liquid glows inside the glass */}
            <group position={[0, -drop - 0.35, 0]}>
              <mesh geometry={flask} scale={[0.86, 0.6, 0.86]} material={liquids[i]} />
              <mesh geometry={flask} material={GLASS} renderOrder={1} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------ back bar ------------------------------ */

/**
 * Meshy's back shelves came out as jagged shards; a dark steel backboard covers
 * them (in front of the back wall, measured at z -2.3 to -2.8) and carries the
 * Astrochimpz collection: Common below, Rare above, One of One on top beside the crown.
 */
const BACK = { z: -1.84, x: [-5.15, -1.75] as const, y: [1.72, 3.5] as const };
const SHELVES: ShelfLayout = {
  common: { y: 1.98, x: [-5.05, -1.85] },
  rare: { y: 2.56, x: [-5.05, -1.85] },
  one_of_one: { y: 3.08, x: [-3.95, -2.05] },
};
const BOARD = new THREE.MeshStandardMaterial({ color: "#16111c", metalness: 0.6, roughness: 0.55 });
const SHELF_EDGE = neon("#ffb04a", 1.25);

function BackBar() {
  const w = BACK.x[1] - BACK.x[0], cx = (BACK.x[0] + BACK.x[1]) / 2;
  return (
    <group>
      <mesh position={[cx, (BACK.y[0] + BACK.y[1]) / 2, BACK.z]} material={BOARD}>
        <boxGeometry args={[w, BACK.y[1] - BACK.y[0], 0.06]} />
      </mesh>
      {Object.values(SHELVES).map((s, i) => (
        <group key={i}>
          <mesh position={[(s.x[0] + s.x[1]) / 2, s.y - 0.015, BACK.z + 0.17]} material={BOARD}>
            <boxGeometry args={[s.x[1] - s.x[0] + 0.1, 0.03, 0.3]} />
          </mesh>
          {/* warm strip along each shelf edge, lighting the bottles from below like the art */}
          <mesh position={[(s.x[0] + s.x[1]) / 2, s.y - 0.03, BACK.z + 0.32]} rotation={[0, 0, Math.PI / 2]} material={SHELF_EDGE}>
            <capsuleGeometry args={[0.01, s.x[1] - s.x[0], 4, 6]} />
          </mesh>
        </group>
      ))}
      <ModelErrorBoundary fallback={null} what="Gravity Well bottle labels">
        <CollectionBottles shelves={SHELVES} rowZ={BACK.z + 0.16} size={0.78} />
      </ModelErrorBoundary>
    </group>
  );
}

/* --------------------------- counter, floor, stools --------------------------- */

/** Dark lacquer over Meshy's pale counter top: a ring round the bar well (measured r 1.26-2.78, top 1.7). */
// Low reflection on purpose: at grazing angles a glossy top mirrors the purple sky and reads as lavender plastic.
const LACQUER = new THREE.MeshPhysicalMaterial({ color: "#0b080d", roughness: 0.45, specularIntensity: 0.15, envMapIntensity: 0.05 });
function CounterTop() {
  return (
    <mesh position={[BAR.x, BAR.top + 0.035, BAR.z]} rotation={[-Math.PI / 2, 0, 0]} material={LACQUER}>
      <ringGeometry args={[1.32, 1.98, 64]} />
    </mesh>
  );
}

/** Dark wet tiles over the pale platform (measured top 0.42-0.47), with soft neon puddles. */
const FLOOR = { x: [-5.9, 5.9] as const, z: [-2.6, 3.4] as const, y: 0.52 }; // just above the highest floor patches (0.42-0.50)
function WetFloor() {
  const tiles = useMemo(() => {
    const t = wetTiles();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1.4);
    return t;
  }, []);
  useEffect(() => () => tiles.dispose(), [tiles]);
  const w = FLOOR.x[1] - FLOOR.x[0], d = FLOOR.z[1] - FLOOR.z[0];
  return (
    <mesh position={[(FLOOR.x[0] + FLOOR.x[1]) / 2, FLOOR.y, (FLOOR.z[0] + FLOOR.z[1]) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      {/* No sky reflection: at walking-eye angles any gloss mirrors the purple sky and the floor reads lavender. */}
      <meshStandardMaterial map={tiles} roughness={0.6} metalness={0} envMapIntensity={0} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}

const FRAME = new THREE.MeshStandardMaterial({ color: "#2b2730", metalness: 0.8, roughness: 0.45 });
const RIM = new THREE.MeshStandardMaterial({ color: "#9b97a0", metalness: 0.9, roughness: 0.35 });
/** Dented silver barrel stools round the front of the bar, as in the art (no names on these). */
const STOOLS: [number, number][] = [[-2.1, 1.75], [-3.2, 2.55], [-4.55, 2.2]];
function BarrelStools() {
  const skins = useMemo(() => STOOLS.map((_, i) => new THREE.MeshStandardMaterial({ map: stoolSkin("", 31 + i * 17), metalness: 0.75, roughness: 0.42 })), []);
  useEffect(() => () => skins.forEach((m) => { m.map?.dispose(); m.dispose(); }), [skins]);
  const r = 0.27, drum = 0.55, leg = 0.28;
  return (
    <group>
      {STOOLS.map(([x, z], i) => (
        <group key={i} position={[x, FLOOR.y, z]} rotation={[0, i * 1.3, 0]}>
          <mesh position={[0, leg * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={FRAME}>
            <torusGeometry args={[r * 0.8, 0.02, 6, 24]} />
          </mesh>
          {[0, 1, 2, 3].map((j) => {
            const a = Math.PI / 4 + (j * Math.PI) / 2;
            return (
              <mesh key={j} position={[Math.sin(a) * r * 0.78, leg / 2, Math.cos(a) * r * 0.78]} material={FRAME}>
                <cylinderGeometry args={[0.022, 0.026, leg, 6]} />
              </mesh>
            );
          })}
          <mesh position={[0, leg + drum / 2, 0]} material={skins[i]}>
            <cylinderGeometry args={[r, r * 0.96, drum, 32]} />
          </mesh>
          {[0.1, 0.9].map((t) => (
            <mesh key={t} position={[0, leg + drum * t, 0]} rotation={[Math.PI / 2, 0, 0]} material={RIM}>
              <torusGeometry args={[r + 0.005, 0.014, 6, 32]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Overlay({ spot, map, glow = 1.3 }: { spot: Spot; map: THREE.Texture; glow?: number }) {
  return (
    <mesh position={spot.at} rotation={[0, spot.ry ?? 0, 0]} renderOrder={2}>
      <planeGeometry args={spot.size} />
      <meshBasicMaterial map={map} color={[glow, glow, glow]} toneMapped={false} transparent polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

type Maps = Record<"main" | "left" | "right" | "menu" | "backCrown" | "windowCrown" | "windowSign", THREE.Texture>;

function useSigns() {
  const [maps, setMaps] = useState<Maps | null>(null);
  useEffect(() => {
    let live = true;
    let made: Maps | null = null;
    Promise.all([loadCrown(), document.fonts.ready]).then(([img]) => {
      if (!live) return;
      made = {
        main: mainSign(img),
        left: leftSign(img),
        right: rightSign(img),
        menu: menuScreen(),
        backCrown: crownPanel(img),
        windowCrown: windowCrown(img),
        windowSign: windowSign(img),
      };
      setMaps(made);
    });
    return () => {
      live = false;
      if (made) Object.values(made).forEach((t) => t.dispose());
    };
  }, []);
  return maps;
}

export function GravityWellLounge({ signs = true }: { signs?: boolean }) {
  const loaded = useSigns();
  const m = signs ? loaded : null;
  return (
    <group>
      <HeroModel url={GRAVITY_WELL_URL} width={WIDTH} tone={0.62} />
      <WetFloor />
      <CounterTop />
      <BarrelStools />
      <BackBar />
      <OrbRing />
      {m && (
        <>
          <Overlay spot={LAYOUT.main} map={m.main} />
          <Overlay spot={LAYOUT.left} map={m.left} />
          <Overlay spot={LAYOUT.right} map={m.right} />
          <Overlay spot={LAYOUT.menu} map={m.menu} glow={1.15} />
          <Overlay spot={LAYOUT.backCrown} map={m.backCrown} />
          <Overlay spot={LAYOUT.windowCrown} map={m.windowCrown} glow={1.1} />
          <Overlay spot={LAYOUT.windowSign} map={m.windowSign} />
        </>
      )}
      {/* Two real lights only (each one costs across the whole world): warm under the ring, pink over the lounge. */}
      <pointLight position={[BAR.x, BAR.top + 0.9, BAR.z]} color="#ffb060" intensity={6} distance={4.5} decay={2} />
      <pointLight position={[3.2, 2.6, 0.6]} color="#ff4fd8" intensity={16} distance={6} decay={2} />
    </group>
  );
}
