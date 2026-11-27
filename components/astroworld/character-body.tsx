"use client";

/**
 * Picks how a character is drawn: the artist's rigged .glb model when one is
 * switched on (public/models/characters/index.json, written by
 * scripts/check-models.mjs), otherwise the code-built ChimpRig.
 *
 * Both are driven by the same PoseInput, so a character can move from the
 * code rig to a real model without touching the game logic. A model that
 * fails to load falls back to the code rig instead of breaking the scene.
 */

import { createContext, Suspense, useContext, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mapClips, resolveRole, type CharacterLook, type ClipRole } from "@chimp-arena/shared";
import { ChimpRig, HeldRifle, type PoseInput } from "./chimp-rig";

const MODEL_DIR = "/models/characters/";
/** Every model is scaled to this height so artists' unit choices don't matter. */
const TARGET_HEIGHT = 1.9;
const FADE = 0.2;

export type ModelIndex = Record<string, { file: string }>;

export const ModelIndexContext = createContext<ModelIndex>({});

/** Load the list of switched-on models once. A missing index just means none yet. */
export async function fetchModelIndex(): Promise<ModelIndex> {
  try {
    const res = await fetch(`${MODEL_DIR}index.json`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as ModelIndex) : {};
  } catch {
    return {};
  }
}

export function CharacterBody({ look, pose }: { look: CharacterLook; pose: () => PoseInput }) {
  const index = useContext(ModelIndexContext);
  const entry = index[look.id];
  const fallback = <ChimpRig look={look} pose={pose} />;
  if (!entry) return fallback;
  return (
    <ModelErrorBoundary key={entry.file} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GlbCharacter url={MODEL_DIR + entry.file} look={look} pose={pose} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

// Moved to its own file so any model component can use it without circular imports.
export { ModelErrorBoundary } from "./model-error-boundary";
import { ModelErrorBoundary } from "./model-error-boundary";

/* ------------------------------ glb model ------------------------------ */

interface GlbRuntime {
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<string, THREE.AnimationAction>>;
  roles: Partial<Record<ClipRole, string>>;
  spine: THREE.Object3D | null;
  current: string | null;
}

/** Which move to play for this pose. */
function roleFor(p: PoseInput): ClipRole {
  if (p.dead) return "death";
  if (p.seated) return "drive";
  if (p.y > 0.15) return "jump";
  if (p.armed) return p.speed > 0.5 ? "rifleWalk" : "rifleIdle";
  if (p.crouch) return "crouch";
  if (p.speed > 6.5) return "run";
  if (p.speed > 0.4) return "walk";
  return "idle";
}

function stepGlb(rt: GlbRuntime, rifle: THREE.Object3D | null, p: PoseInput, dt: number) {
  const clip = resolveRole(roleFor(p), rt.roles);
  if (clip && clip !== rt.current) {
    const next = rt.actions[clip];
    const prev = rt.current ? rt.actions[rt.current] : undefined;
    if (next) {
      const once = roleFor(p) === "death";
      next.reset();
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      next.fadeIn(FADE).play();
      prev?.fadeOut(FADE);
      rt.current = clip;
    }
  }
  // Match the walk cycle to how fast the character is actually moving.
  const cur = rt.current ? rt.actions[rt.current] : undefined;
  if (cur) {
    const role = roleFor(p);
    cur.timeScale = role === "walk" || role === "rifleWalk" || role === "crouch" ? THREE.MathUtils.clamp(p.speed / 4.5, 0.6, 1.6) : role === "run" ? THREE.MathUtils.clamp(p.speed / 8, 0.8, 1.3) : 1;
  }
  rt.mixer.update(Math.min(dt, 0.1));
  // Aim: bend the upper spine with the camera pitch on top of the animation.
  if (rt.spine && p.armed && !p.dead) rt.spine.rotation.x -= p.pitch * 0.6;
  if (rifle) rifle.visible = p.armed && !p.dead;
}

function GlbCharacter({ url, look, pose }: { url: string; look: CharacterLook; pose: () => PoseInput }) {
  // Meshopt-compressed models decode locally; no third-party decoder download.
  const gltf = useGLTF(url, false, true);
  const rifleRef = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    // Normalise: TARGET_HEIGHT tall, feet on the ground, centred. Bones must be
    // posed first: skinned bounds follow the skeleton, and Mixamo exports keep
    // the mesh at 1/100 scale under full-size bones - measured unposed, a
    // 1.75 m character reads as 1.75 cm and gets blown up 100x.
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    const h = box.max.y - box.min.y || 1;
    const s = TARGET_HEIGHT / h;
    scene.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    scene.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; // skinned bounds lag behind animation
    });
    return scene;
  }, [gltf.scene]);

  const rt = useMemo<GlbRuntime>(() => {
    const mixer = new THREE.AnimationMixer(model);
    const actions: GlbRuntime["actions"] = {};
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    let spine: THREE.Object3D | null = null;
    // three.js strips ":" from names, so Mixamo's "mixamorig:Spine2" arrives as "mixamorigSpine2".
    for (const re of [/spine2$/i, /spine1$/i, /spine$/i]) {
      model.traverse((o) => {
        if (!spine && re.test(o.name)) spine = o;
      });
      if (spine) break;
    }
    return { mixer, actions, roles: mapClips(gltf.animations.map((a) => a.name)), spine, current: null };
  }, [model, gltf.animations]);

  useEffect(() => () => void rt.mixer.stopAllAction(), [rt]);

  useFrame((_, dt) => stepGlb(rt, rifleRef.current, pose(), dt));

  return (
    <group>
      <primitive object={model} />
      {/* Rifle held at the chest, like the code rig, until models ship a hand socket. */}
      <group ref={rifleRef} position={[0.05, 1.28, 0.36]} visible={false}>
        <HeldRifle glow={look.glow} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={-1}>
        <circleGeometry args={[0.45, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}
