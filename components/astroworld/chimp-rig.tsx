"use client";

/**
 * A rigged, animated 3D Astrochimp built from code - one per NFT design.
 *
 * The skeleton is a joint hierarchy (hips -> spine -> neck/head, shoulders ->
 * elbows -> hands, hips -> knees -> feet). Each frame the animation driver
 * poses those joints from the character's movement: idle breathing, walk and
 * sprint cycles, crouch, jump, rifle aim with pitch, sitting in a rover, and
 * a death fall. Outfits, headwear and colours come from the NFT's look
 * (shared/src/character-looks.ts).
 *
 * Swap-in path for artist-made models: a rigged .glb per character id in
 * public/models/characters/ with the standard clip names replaces this mesh
 * (see docs/3d-characters.md). The pose inputs below stay the same.
 */

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GearModel } from "./gear";
import type { CharacterLook } from "@chimp-arena/shared";

/** What the animation driver needs each frame. Written by the owner, read here. */
export interface PoseInput {
  /** Horizontal speed, m/s. */
  speed: number;
  /** Signed forward/back component of the speed (strafing gives ~0). */
  forward: number;
  /** Feet height above ground. */
  y: number;
  crouch: boolean;
  /** Rifle up (combat zone, on foot). */
  armed: boolean;
  /** Aim pitch, radians (up positive). */
  pitch: number;
  seated: boolean;
  dead: boolean;
  /** Seconds since the last shot - drives recoil kick. */
  sinceShot: number;
}

export const idlePose = (): PoseInput => ({
  speed: 0,
  forward: 0,
  y: 0,
  crouch: false,
  armed: false,
  pitch: 0,
  seated: false,
  dead: false,
  sinceShot: 10,
});

/* -------------------------- shared geometry -------------------------- */

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  hemi: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  capsule: new THREE.CapsuleGeometry(1, 1, 6, 12),
  cone: new THREE.ConeGeometry(1, 1, 16, 1, true),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  ring: new THREE.TorusGeometry(1, 0.12, 8, 24),
};

function useMaterials(look: CharacterLook) {
  return useMemo(() => {
    const std = (color: string, metalness = 0.3, roughness = 0.55) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
    return {
      suit: std(look.suit, look.outfit === "gown" ? 0.7 : 0.35, look.outfit === "gown" ? 0.25 : 0.5),
      trim: std(look.trim, 0.45, 0.45),
      dark: std("#16141c", 0.6, 0.4),
      boot: std("#1d1b22", 0.4, 0.6),
      fur: std(look.fur, 0, 0.9),
      // Chimps with the default fur get a tan face; custom skin (e.g. teal) tints the face too.
      face: std(look.species === "chimp" && look.fur === "#4a2f1d" ? "#c99a6e" : shade(look.fur, look.species === "chimp" ? 1.3 : 1.15), 0, 0.85),
      hair: std(look.hair ?? "#1a1a1a", 0.1, 0.7),
      gold: std("#d4a93a", 0.9, 0.25),
      white: std("#e8e8ee", 0.2, 0.5),
      glow: new THREE.MeshBasicMaterial({ color: look.glow, toneMapped: false }),
      accent: new THREE.MeshBasicMaterial({ color: look.accent ?? look.glow, toneMapped: false }),
      eye: new THREE.MeshBasicMaterial({ color: "#0b0b0d" }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#cfe8ff",
        transparent: true,
        opacity: 0.22,
        roughness: 0.05,
        metalness: 0.1,
        depthWrite: false,
      }),
    };
  }, [look]);
}
type Mats = ReturnType<typeof useMaterials>;

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** A mesh with a shared unit geometry, scaled. */
function P({
  g,
  m,
  p = [0, 0, 0],
  s = [1, 1, 1],
  r = [0, 0, 0],
}: {
  g: THREE.BufferGeometry;
  m: THREE.Material;
  p?: [number, number, number];
  s?: [number, number, number] | number;
  r?: [number, number, number];
}) {
  const scale: [number, number, number] = typeof s === "number" ? [s, s, s] : s;
  return <mesh geometry={g} material={m} position={p} scale={scale} rotation={r} />;
}

/* ------------------------------ parts ------------------------------ */

function Head({ look, m }: { look: CharacterLook; m: Mats }) {
  const dog = look.species === "dog";
  const cat = look.species === "cat";
  return (
    <group>
      <P g={G.sphere} m={m.fur} p={[0, 0.2, 0]} s={[0.27, 0.29, 0.27]} />
      {/* muzzle / snout */}
      {/* masked characters: the face is covered (see Headwear), only glowing eyes show */}
      <P g={G.sphere} m={look.mask ? m.dark : m.face} p={[0, 0.13, dog ? 0.24 : 0.18]} s={dog ? [0.13, 0.11, 0.17] : [0.17, 0.13, 0.12]} />
      <P g={G.sphere} m={look.mask ? m.dark : m.face} p={[0, 0.27, 0.17]} s={[0.17, 0.1, 0.1]} />
      {!look.mask && <P g={G.sphere} m={m.eye} p={[-0.085, 0.27, 0.235]} s={0.035} />}
      {!look.mask && <P g={G.sphere} m={m.eye} p={[0.085, 0.27, 0.235]} s={0.035} />}
      {dog && <P g={G.sphere} m={m.eye} p={[0, 0.17, 0.4]} s={0.04} />}
      {/* ears */}
      {cat ? (
        <>
          <P g={G.cone4} m={m.fur} p={[-0.15, 0.48, 0]} s={[0.08, 0.16, 0.06]} />
          <P g={G.cone4} m={m.fur} p={[0.15, 0.48, 0]} s={[0.08, 0.16, 0.06]} />
        </>
      ) : dog ? (
        <>
          <P g={G.sphere} m={m.fur} p={[-0.25, 0.22, -0.02]} s={[0.07, 0.15, 0.1]} r={[0, 0, 0.3]} />
          <P g={G.sphere} m={m.fur} p={[0.25, 0.22, -0.02]} s={[0.07, 0.15, 0.1]} r={[0, 0, -0.3]} />
        </>
      ) : (
        <>
          <P g={G.sphere} m={m.face} p={[-0.28, 0.22, 0]} s={[0.05, 0.09, 0.08]} />
          <P g={G.sphere} m={m.face} p={[0.28, 0.22, 0]} s={[0.05, 0.09, 0.08]} />
        </>
      )}
      <Headwear look={look} m={m} />
    </group>
  );
}

function Headwear({ look, m }: { look: CharacterLook; m: Mats }) {
  switch (look.head) {
    case "helmet":
      return (
        <group>
          <P g={G.sphere} m={m.glass} p={[0, 0.22, 0.02]} s={0.4} />
          <P g={G.ring} m={m.white} p={[0, -0.08, 0]} s={[0.33, 0.33, 0.6]} r={[Math.PI / 2, 0, 0]} />
          <P g={G.box} m={m.glow} p={[0.34, 0.24, 0]} s={[0.04, 0.12, 0.12]} />
        </group>
      );
    case "hood":
      return (
        <group>
          {/* shell over the crown, drapes down the sides and back, peak over the brow */}
          <P g={G.hemi} m={m.trim} p={[0, 0.2, -0.1]} s={[0.35, 0.42, 0.33]} />
          <P g={G.box} m={m.trim} p={[-0.29, 0.08, 0.02]} s={[0.07, 0.42, 0.4]} />
          <P g={G.box} m={m.trim} p={[0.29, 0.08, 0.02]} s={[0.07, 0.42, 0.4]} />
          <P g={G.box} m={m.trim} p={[0, 0.03, -0.22]} s={[0.6, 0.46, 0.12]} />
          <P g={G.box} m={m.trim} p={[0, 0.47, 0.13]} s={[0.4, 0.07, 0.16]} r={[0.45, 0, 0]} />
          {/* glyph trim down the hood's front edges */}
          <P g={G.box} m={m.accent} p={[-0.26, 0.16, 0.22]} s={[0.025, 0.34, 0.02]} r={[0, 0, -0.12]} />
          <P g={G.box} m={m.accent} p={[0.26, 0.16, 0.22]} s={[0.025, 0.34, 0.02]} r={[0, 0, 0.12]} />
          {look.mask ? (
            <>
              {/* mask over the muzzle, lit seam, glowing eyes */}
              <P g={G.box} m={m.dark} p={[0, 0.12, 0.25]} s={[0.3, 0.16, 0.08]} />
              <P g={G.box} m={m.glow} p={[0, 0.12, 0.295]} s={[0.16, 0.018, 0.01]} />
              <P g={G.box} m={m.dark} p={[0, 0.27, 0.235]} s={[0.3, 0.07, 0.05]} />
              <P g={G.sphere} m={m.glow} p={[-0.075, 0.28, 0.27]} s={[0.05, 0.026, 0.02]} />
              <P g={G.sphere} m={m.glow} p={[0.075, 0.28, 0.27]} s={[0.05, 0.026, 0.02]} />
            </>
          ) : (
            <P g={G.box} m={m.glow} p={[0, 0.36, 0.27]} s={[0.24, 0.025, 0.02]} />
          )}
        </group>
      );
    case "fedora":
      return (
        <group position={[0, 0.42, 0]} rotation={[-0.08, 0, 0]}>
          <P g={G.cyl} m={m.suit} s={[0.42, 0.02, 0.42]} />
          <P g={G.cyl} m={m.suit} p={[0, 0.1, 0]} s={[0.24, 0.2, 0.24]} />
          <P g={G.cyl} m={m.trim} p={[0, 0.03, 0]} s={[0.245, 0.04, 0.245]} />
        </group>
      );
    case "crown":
      return (
        <group position={[0, 0.45, 0]}>
          <P g={G.cyl} m={m.gold} s={[0.2, 0.08, 0.2]} />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return <P key={i} g={G.cone4} m={m.gold} p={[Math.sin(a) * 0.17, 0.1, Math.cos(a) * 0.17]} s={[0.045, 0.14, 0.045]} />;
          })}
          <P g={G.sphere} m={m.glow} p={[0, 0, 0.2]} s={0.035} />
          {look.hair && <P g={G.sphere} m={m.hair} p={[0, -0.2, -0.17]} s={[0.24, 0.3, 0.16]} />}
        </group>
      );
    case "cap":
      return (
        <group position={[0, 0.36, 0]}>
          <P g={G.hemi} m={m.suit} s={[0.28, 0.16, 0.28]} />
          <P g={G.box} m={m.suit} p={[0, 0.01, 0.27]} s={[0.3, 0.02, 0.18]} />
          <P g={G.box} m={m.gold} p={[0, 0.08, 0.27]} s={[0.08, 0.05, 0.02]} />
        </group>
      );
    case "hair":
      return (
        <group>
          <P g={G.hemi} m={m.hair} p={[0, 0.26, -0.03]} s={[0.29, 0.25, 0.29]} />
          <P g={G.sphere} m={m.hair} p={[0, 0.08, -0.17]} s={[0.25, 0.32, 0.14]} />
          <P g={G.sphere} m={m.hair} p={[0, 0.5, -0.12]} s={0.1} />
        </group>
      );
    case "goggles":
      return (
        <group position={[0, 0.3, 0]}>
          <P g={G.cyl} m={m.dark} s={[0.285, 0.05, 0.285]} />
          <P g={G.sphere} m={m.glow} p={[-0.09, 0, 0.25]} s={[0.065, 0.05, 0.03]} />
          <P g={G.sphere} m={m.glow} p={[0.09, 0, 0.25]} s={[0.065, 0.05, 0.03]} />
        </group>
      );
    case "tactical":
      return (
        <group>
          <P g={G.hemi} m={m.suit} p={[0, 0.2, 0]} s={[0.33, 0.36, 0.34]} />
          <P g={G.box} m={m.glow} p={[0, 0.25, 0.27]} s={[0.36, 0.1, 0.06]} />
          <P g={G.box} m={m.trim} p={[0, 0.06, 0]} s={[0.6, 0.12, 0.5]} />
        </group>
      );
    case "bandana":
      return <P g={G.cyl} m={m.trim} p={[0, 0.36, 0]} s={[0.28, 0.06, 0.28]} />;
    default:
      return null;
  }
}

/** Torso + outfit pieces that move with the spine. */
function Torso({ look, m }: { look: CharacterLook; m: Mats }) {
  const o = look.outfit;
  const bulky = o === "suit" || o === "armor";
  const w = bulky ? 0.3 : o === "gown" ? 0.22 : 0.26;
  return (
    <group>
      <P g={G.capsule} m={m.suit} p={[0, 0.3, 0]} s={[w, 0.22, w * 0.8]} />
      {o === "suit" && (
        <>
          <P g={G.box} m={m.white} p={[0, 0.42, 0.24]} s={[0.3, 0.18, 0.05]} />
          <P g={G.box} m={m.glow} p={[0, 0.42, 0.27]} s={[0.18, 0.04, 0.01]} />
          <P g={G.box} m={m.trim} p={[-0.14, 0.25, 0.22]} s={[0.05, 0.42, 0.05]} />
          <P g={G.box} m={m.trim} p={[0.14, 0.25, 0.22]} s={[0.05, 0.42, 0.05]} />
          <P g={G.box} m={m.white} p={[0, 0.36, -0.3]} s={[0.42, 0.5, 0.2]} />
          <P g={G.box} m={m.glow} p={[0, 0.36, -0.41]} s={[0.22, 0.05, 0.01]} />
        </>
      )}
      {o === "armor" && (
        <>
          <P g={G.box} m={m.dark} p={[0, 0.35, 0.18]} s={[0.46, 0.4, 0.14]} />
          <P g={G.box} m={m.glow} p={[-0.12, 0.38, 0.26]} s={[0.03, 0.24, 0.01]} />
          <P g={G.box} m={m.glow} p={[0.12, 0.38, 0.26]} s={[0.03, 0.24, 0.01]} />
          <P g={G.sphere} m={m.trim} p={[-0.34, 0.55, 0]} s={[0.15, 0.1, 0.15]} />
          <P g={G.sphere} m={m.trim} p={[0.34, 0.55, 0]} s={[0.15, 0.1, 0.15]} />
          <P g={G.box} m={m.dark} p={[0, 0.02, 0]} s={[0.5, 0.08, 0.36]} />
        </>
      )}
      {o === "coat" && (
        <>
          <P g={G.box} m={m.trim} p={[-0.09, 0.35, 0.22]} s={[0.05, 0.42, 0.02]} r={[0, 0, -0.2]} />
          <P g={G.box} m={m.trim} p={[0.09, 0.35, 0.22]} s={[0.05, 0.42, 0.02]} r={[0, 0, 0.2]} />
          <P g={G.box} m={m.glow} p={[0, 0.4, 0.215]} s={[0.04, 0.2, 0.01]} />
        </>
      )}
      {o === "casual" && (
        <>
          <P g={G.box} m={m.trim} p={[0, 0.3, 0.215]} s={[0.12, 0.46, 0.02]} />
          <P g={G.box} m={m.glow} p={[0.12, 0.45, 0.2]} s={[0.06, 0.04, 0.01]} />
        </>
      )}
      {(o === "royal" || o === "gown") && <P g={G.box} m={o === "royal" ? m.gold : m.glow} p={[0, 0.48, 0.19]} s={[0.24, 0.03, 0.02]} />}
      {o === "royal" && <P g={G.box} m={m.trim} p={[0, 0.0, -0.26]} s={[0.62, 1.15, 0.04]} />}
      {look.cloak && <Cloak m={m} />}
    </group>
  );
}

/** Ragged cloak: a mantle over the shoulders and uneven strips hanging down the back. */
const CLOAK_STRIPS: [number, number, number][] = [
  [-0.27, 1.0, 0.05],
  [-0.16, 1.2, -0.1],
  [-0.05, 0.95, 0.08],
  [0.06, 1.25, -0.06],
  [0.17, 1.05, 0.1],
  [0.28, 0.9, -0.08],
];
function Cloak({ m }: { m: Mats }) {
  return (
    <group>
      <P g={G.capsule} m={m.trim} p={[0, 0.5, -0.02]} s={[0.4, 0.1, 0.3]} />
      {CLOAK_STRIPS.map(([x, len, tilt], i) => (
        <P key={i} g={G.box} m={m.trim} p={[x, 0.55 - len / 2, -0.27]} s={[0.12, len, 0.03]} r={[0.08, 0, tilt]} />
      ))}
      <P g={G.box} m={m.accent} p={[0, 0.5, -0.29]} s={[0.5, 0.025, 0.01]} />
    </group>
  );
}

/** Long garments that hang from the hips (coat tails, gowns, robes). */
function Skirt({ look, m }: { look: CharacterLook; m: Mats }) {
  if (look.outfit === "coat") return <P g={G.cone} m={m.suit} p={[0, -0.38, 0]} s={[0.36, 0.78, 0.3]} r={[Math.PI, 0, 0]} />;
  if (look.outfit === "gown" || look.outfit === "royal")
    return <P g={G.cone} m={look.outfit === "royal" ? m.trim : m.suit} p={[0, -0.47, 0]} s={[0.46, 1.0, 0.42]} r={[Math.PI, 0, 0]} />;
  return null;
}

type RifleMats = Pick<Mats, "dark" | "glow" | "trim">;

/** The Astral rifle on its own, for models that don't come with one. */
export function HeldRifle({ glow }: { glow: string }) {
  const m = useMemo<RifleMats>(
    () => ({
      dark: new THREE.MeshStandardMaterial({ color: "#16141c", metalness: 0.6, roughness: 0.4 }),
      trim: new THREE.MeshStandardMaterial({ color: "#2a2638", metalness: 0.45, roughness: 0.45 }),
      glow: new THREE.MeshBasicMaterial({ color: glow, toneMapped: false }),
    }),
    [glow],
  );
  return <TeamRifle m={m} />;
}

/**
 * The team's Standard Rifle model, laid along the code rifle's axis (barrel
 * toward +z, grip at the origin). The code-built rifle shows while it loads.
 */
function TeamRifle({ m }: { m: RifleMats }) {
  return (
    <Suspense fallback={<Rifle m={m} />}>
      <group position={[0, 0.02, 0.24]} rotation={[0, Math.PI / 2, 0]}>
        <GearModel id="rifle-standard" length={1.05} />
      </group>
    </Suspense>
  );
}

function Rifle({ m }: { m: RifleMats }) {
  return (
    <group>
      <P g={G.box} m={m.dark} p={[0, 0, 0.25]} s={[0.08, 0.13, 0.75]} />
      <P g={G.box} m={m.dark} p={[0, -0.12, 0.08]} s={[0.06, 0.18, 0.08]} />
      <P g={G.box} m={m.glow} p={[0, -0.13, 0.28]} s={[0.05, 0.2, 0.06]} />
      <P g={G.box} m={m.glow} p={[0.045, 0.02, 0.3]} s={[0.01, 0.04, 0.45]} />
      <P g={G.box} m={m.dark} p={[0, 0.1, 0.2]} s={[0.05, 0.06, 0.16]} />
      <P g={G.cyl} m={m.dark} p={[0, 0.02, 0.7]} s={[0.025, 0.2, 0.025]} r={[Math.PI / 2, 0, 0]} />
      <P g={G.box} m={m.trim} p={[0, -0.02, -0.18]} s={[0.07, 0.12, 0.22]} />
    </group>
  );
}

function Blade({ m }: { m: Mats }) {
  return (
    <group>
      <P g={G.box} m={m.dark} s={[0.05, 0.05, 0.22]} />
      <P g={G.box} m={m.glow} p={[0, 0, 0.6]} s={[0.03, 0.08, 1.0]} />
    </group>
  );
}

function Pickaxe({ m }: { m: Mats }) {
  return (
    <group>
      <P g={G.cyl} m={m.dark} p={[0, 0, 0.35]} s={[0.025, 0.85, 0.025]} r={[Math.PI / 2, 0, 0]} />
      <P g={G.box} m={m.glow} p={[0, 0, 0.75]} s={[0.05, 0.5, 0.06]} r={[0.25, 0, 0]} />
    </group>
  );
}

/* --------------------------- the rig itself --------------------------- */

type JointRef = React.RefObject<THREE.Group | null>;

function RigArm({ look, m, side, sh, el, gear }: { look: CharacterLook; m: Mats; side: 1 | -1; sh: JointRef; el: JointRef; gear?: JointRef }) {
  const sleeve = look.outfit === "gown" ? m.fur : m.suit;
  const glove = look.outfit === "suit" || look.outfit === "armor" ? m.dark : m.face;
  return (
    <group ref={sh} position={[side * -0.34, 0.5, 0]}>
      <P g={G.capsule} m={sleeve} p={[0, -UP_ARM / 2, 0]} s={[0.085, UP_ARM / 2, 0.085]} />
      {look.outfit === "suit" && <P g={G.cyl} m={m.trim} p={[0, -UP_ARM + 0.02, 0]} s={[0.1, 0.05, 0.1]} />}
      <group ref={el} position={[0, -UP_ARM, 0]}>
        <P g={G.capsule} m={sleeve} p={[0, -FORE_ARM / 2, 0]} s={[0.075, FORE_ARM / 2, 0.075]} />
        <P g={G.sphere} m={glove} p={[0, -FORE_ARM - 0.06, 0]} s={0.085} />
        {gear && (
          <group ref={gear} position={[0, -FORE_ARM - 0.08, 0.05]} rotation={[-1.2, 0, 0]}>
            {look.gear === "blade" && <Blade m={m} />}
            {look.gear === "pickaxe" && <Pickaxe m={m} />}
          </group>
        )}
      </group>
    </group>
  );
}

function RigLeg({ look, m, side, hip, knee }: { look: CharacterLook; m: Mats; side: 1 | -1; hip: JointRef; knee: JointRef }) {
  const pants = look.outfit === "casual" ? m.trim : look.outfit === "coat" ? m.dark : m.suit;
  return (
    <group ref={hip} position={[side * -0.14, 0, 0]}>
      <P g={G.capsule} m={pants} p={[0, -THIGH / 2, 0]} s={[0.11, THIGH / 2, 0.11]} />
      <group ref={knee} position={[0, -THIGH, 0]}>
        <P g={G.capsule} m={pants} p={[0, -SHIN / 2, 0]} s={[0.1, SHIN / 2, 0.1]} />
        {look.outfit === "suit" && <P g={G.cyl} m={m.trim} p={[0, -0.05, 0]} s={[0.12, 0.06, 0.12]} />}
        <P g={G.box} m={look.outfit === "suit" ? m.white : m.boot} p={[0, -SHIN - 0.02, 0.06]} s={[0.17, 0.12, 0.3]} />
      </group>
    </group>
  );
}

const UP_ARM = 0.3;
const FORE_ARM = 0.28;
const THIGH = 0.42;
const SHIN = 0.42;
const HIP_Y = 0.92;

type G3 = THREE.Group | null;
interface Joints {
  root: G3;
  hips: G3;
  spine: G3;
  head: G3;
  aim: G3;
  shL: G3;
  shR: G3;
  elL: G3;
  elR: G3;
  hipL: G3;
  hipR: G3;
  kneeL: G3;
  kneeR: G3;
  rifleHands: G3;
  rifleBack: G3;
  gearHand: G3;
}
interface RigState {
  phase: number;
  crouch: number;
  armed: number;
  fall: number;
  air: number;
  seated: number;
}

const rot = (g: G3, x: number, y = 0, z = 0) => g?.rotation.set(x, y, z);

/** Pose every joint for this frame from the movement inputs. */
function animateRig(j: Joints, s: RigState, p: PoseInput, gear: CharacterLook["gear"], rawDt: number, t: number) {
  const dt = Math.min(rawDt, 0.1);
  const ease = (cur: number, to: number, rate: number) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
  s.crouch = ease(s.crouch, p.crouch ? 1 : 0, 10);
  s.armed = ease(s.armed, p.armed ? 1 : 0, 12);
  s.fall = ease(s.fall, p.dead ? 1 : 0, 6);
  s.air = ease(s.air, p.y > 0.05 ? 1 : 0, 14);
  s.seated = ease(s.seated, p.seated ? 1 : 0, 10);

  const moving = Math.min(p.speed / 5, 1.6) * (1 - s.air) * (1 - s.seated);
  s.phase += dt * (4 + p.speed * 1.25) * (p.forward < -0.1 ? -1 : 1);
  const ph = s.phase;
  const swing = Math.sin(ph) * 0.55 * moving;

  // Hips: bob while moving, sink when crouching or seated; the whole body falls when dead.
  if (j.hips) j.hips.position.y = HIP_Y - s.crouch * 0.32 - s.seated * 0.35 + Math.abs(Math.cos(ph)) * 0.05 * moving + Math.sin(t * 2) * 0.008;
  if (j.root) {
    j.root.rotation.x = -s.fall * (Math.PI / 2) * 0.95;
    j.root.position.y = s.fall * 0.25;
  }

  // Spine: lean into sprints, hunch when crouched, follow aim pitch when armed.
  rot(j.spine, moving * 0.12 + s.crouch * 0.25 - s.armed * p.pitch * 0.35, Math.sin(ph) * 0.06 * moving * (1 - s.armed));
  rot(j.head, -p.pitch * 0.5 * s.armed - s.crouch * 0.15);
  rot(j.aim, -p.pitch * 0.65 * s.armed);

  // Legs: stride, knee bend on the back-swing, tuck in the air, sit in the rover.
  for (const [hip, knee, side] of [
    [j.hipL, j.kneeL, 1],
    [j.hipR, j.kneeR, -1],
  ] as const) {
    rot(hip, side * swing - s.crouch * 1.0 - s.air * 0.7 * (side === 1 ? 1 : 0.4) - s.seated * 1.45, 0, side * 0.04);
    const bend = Math.max(0, -Math.sin(ph + (side === 1 ? 0 : Math.PI))) * 0.9 * moving;
    rot(knee, bend + s.crouch * 1.7 + s.air * 1.1 + s.seated * 1.45);
  }

  // Arms: swing when relaxed, shoulder the rifle when armed (with recoil kick).
  const kick = Math.max(0, 1 - p.sinceShot * 12) * 0.12;
  const a = s.armed;
  rot(j.shL, -swing * 0.9 * (1 - a) + a * (-1.35 - kick), 0, (1 - a) * 0.12 + a * 0.55);
  rot(j.elL, (1 - a) * (-0.25 - Math.max(0, swing) * 0.4) + a * -0.25);
  rot(j.shR, swing * 0.9 * (1 - a) + a * (-1.45 - kick), 0, -(1 - a) * 0.12 - a * 0.25);
  rot(j.elR, (1 - a) * (-0.25 - Math.max(0, -swing) * 0.4) + a * -0.95);
  if (j.rifleHands) j.rifleHands.visible = a > 0.5;
  if (j.rifleBack) j.rifleBack.visible = a <= 0.5 && gear === "rifle";
  if (j.gearHand) j.gearHand.visible = a <= 0.5 && gear !== "rifle" && gear !== "none";
}

/**
 * Poseable character. `pose` is read every frame - the owner keeps it
 * updated (local player from input, remote players from network state).
 */
export function ChimpRig({ look, pose }: { look: CharacterLook; pose: () => PoseInput }) {
  const m = useMaterials(look);
  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const aim = useRef<THREE.Group>(null);
  const shL = useRef<THREE.Group>(null);
  const shR = useRef<THREE.Group>(null);
  const elL = useRef<THREE.Group>(null);
  const elR = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const rifleHands = useRef<THREE.Group>(null);
  const rifleBack = useRef<THREE.Group>(null);
  const gearHand = useRef<THREE.Group>(null);
  const rig = useRef<RigState>({ phase: 0, crouch: 0, armed: 0, fall: 0, air: 0, seated: 0 });
  const hidesLegs = look.outfit === "gown" || look.outfit === "royal";

  useFrame((state, dt) =>
    animateRig(
      {
        root: root.current,
        hips: hips.current,
        spine: spine.current,
        head: head.current,
        aim: aim.current,
        shL: shL.current,
        shR: shR.current,
        elL: elL.current,
        elR: elR.current,
        hipL: hipL.current,
        hipR: hipR.current,
        kneeL: kneeL.current,
        kneeR: kneeR.current,
        rifleHands: rifleHands.current,
        rifleBack: rifleBack.current,
        gearHand: gearHand.current,
      },
      rig.current,
      pose(),
      look.gear,
      dt,
      state.clock.elapsedTime,
    ),
  );

  return (
    <group ref={root}>
      <group ref={hips} position={[0, HIP_Y, 0]}>
        {!hidesLegs && (
          <>
            <RigLeg look={look} m={m} side={1} hip={hipL} knee={kneeL} />
            <RigLeg look={look} m={m} side={-1} hip={hipR} knee={kneeR} />
          </>
        )}
        <Skirt look={look} m={m} />
        <group ref={spine}>
          <Torso look={look} m={m} />
          <group ref={head} position={[0, 0.66, 0]}>
            <Head look={look} m={m} />
          </group>
          <group ref={aim}>
            <RigArm look={look} m={m} side={1} sh={shL} el={elL} />
            <RigArm look={look} m={m} side={-1} sh={shR} el={elR} gear={gearHand} />
            <group ref={rifleHands} position={[-0.12, 0.34, 0.38]}>
              <TeamRifle m={m} />
            </group>
          </group>
          <group ref={rifleBack} position={[0, 0.35, -0.3]} rotation={[0, 0, 0.8]}>
            <group rotation={[0, Math.PI / 2, 0]}>
              <TeamRifle m={m} />
            </group>
          </group>
        </group>
      </group>
      {/* contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={-1}>
        <circleGeometry args={[0.45, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}
