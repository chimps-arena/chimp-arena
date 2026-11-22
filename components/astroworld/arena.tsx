"use client";

/**
 * Chapter 3, "The Games": the Gladiator Arena, Caesar's trials and the
 * training drones.
 *
 * - Arena: the walled ring (shared ARENA layout; its wall stops bullets on
 *   the server too), tiered stands, floodlights, banners and the trial gate.
 * - Trials: press E at the gate, then shoot as many training drones as you
 *   can in 60 seconds. Drones are local to you (practice, not networked);
 *   hits are checked against your own shots in hub-scene's stepLocal via
 *   arenaShot(). Results go to story-state (reputation with your sponsor).
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ARENA, ARENA_SEGMENTS, ARENA_WALL_HEIGHT, arenaGate } from "@chimp-arena/shared";
import { Html } from "./drei-html";
import { sfx } from "./audio";
import { registerInteractable, type NpcSpec } from "./npcs";
import { chapter2Done, recordTrial, storyStore, TRIAL_CHAMPION, TRIAL_PASS } from "./story-state";

export const TRIAL_SECONDS = 60;
const DRONES = 6;
const DRONE_RADIUS = 0.75;

/* ------------------------------ trial state ------------------------------ */

export interface TrialState {
  running: boolean;
  endsAt: number;
  score: number;
  /** Last finished trial's score (shown on the results card), -1 for none. */
  last: number;
  lastAt: number;
}

let trial: TrialState = { running: false, endsAt: 0, score: 0, last: -1, lastAt: 0 };
const subs = new Set<() => void>();
function setTrial(next: TrialState) {
  trial = next;
  subs.forEach((cb) => cb());
}
export const trialStore = {
  get: () => trial,
  subscribe: (cb: () => void) => {
    subs.add(cb);
    return () => void subs.delete(cb);
  },
};

interface Drone {
  pos: THREE.Vector3;
  base: THREE.Vector3;
  phase: number;
  alive: boolean;
  /** When it pops back after being hit. */
  respawnAt: number;
}

const drones: Drone[] = Array.from({ length: DRONES }, (_, i) => ({
  pos: new THREE.Vector3(),
  base: new THREE.Vector3(),
  phase: i * 1.7,
  alive: false,
  respawnAt: 0,
}));

function placeDrone(d: Drone) {
  const a = Math.random() * Math.PI * 2;
  const r = 8 + Math.random() * (ARENA.radius - 14);
  d.base.set(ARENA.x + Math.sin(a) * r, 1.6 + Math.random() * 4, ARENA.z + Math.cos(a) * r);
  d.pos.copy(d.base);
  d.phase = Math.random() * 10;
  d.alive = true;
}

// Dev QA only: scripts/astroworld-snapshot.mjs aims test shots at the drones.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  Object.assign(window, {
    __awShootDrone: () => {
      const d = drones.find((x) => x.alive);
      if (!d) return false;
      const origin = d.pos.clone().add(new THREE.Vector3(0, 0, -10));
      return arenaShot(origin, new THREE.Vector3(0, 0, 1), 200);
    },
  });
}

export function startTrial() {
  if (trial.running) return;
  drones.forEach(placeDrone);
  setTrial({ ...trial, running: true, endsAt: Date.now() + TRIAL_SECONDS * 1000, score: 0 });
  sfx.objective();
}

function finishTrial() {
  const score = trial.score;
  drones.forEach((d) => (d.alive = false));
  setTrial({ ...trial, running: false, last: score, lastAt: Date.now() });
  recordTrial(score);
}

const sphereHit = new THREE.Vector3();
/**
 * Called for every shot the local player fires. If a trial is running and
 * the shot crosses a drone within `maxT`, that drone pops and scores.
 */
export function arenaShot(origin: THREE.Vector3, dir: THREE.Vector3, maxT: number): boolean {
  if (!trial.running) return false;
  let best: Drone | null = null;
  let bestT = maxT;
  for (const d of drones) {
    if (!d.alive) continue;
    sphereHit.copy(d.pos).sub(origin);
    const t = sphereHit.dot(dir);
    if (t < 0 || t > bestT) continue;
    const miss = sphereHit.lengthSq() - t * t;
    if (miss <= DRONE_RADIUS * DRONE_RADIUS) {
      best = d;
      bestT = t;
    }
  }
  if (!best) return false;
  best.alive = false;
  best.respawnAt = performance.now() + 450;
  setTrial({ ...trial, score: trial.score + 1 });
  sfx.hit();
  return true;
}

/** Frame step: drone motion, respawns, and the trial clock. */
function tickTrial(t: number, meshes: (THREE.Object3D | null)[]) {
  if (trial.running && Date.now() >= trial.endsAt) finishTrial();
  const now = performance.now();
  drones.forEach((d, i) => {
    if (trial.running && !d.alive && d.respawnAt && now >= d.respawnAt) {
      placeDrone(d);
      d.respawnAt = 0;
    }
    if (d.alive) {
      d.pos.set(d.base.x + Math.sin(t * 0.9 + d.phase) * 3, d.base.y + Math.sin(t * 1.7 + d.phase) * 0.8, d.base.z + Math.cos(t * 0.7 + d.phase) * 3);
    }
    const m = meshes[i];
    if (m) {
      m.visible = d.alive;
      m.position.copy(d.pos);
      m.rotation.y = t * 2 + d.phase;
    }
  });
}

/* ------------------------------ the arena ------------------------------ */

const wallMat = new THREE.MeshStandardMaterial({ color: "#3a2f4f", metalness: 0.55, roughness: 0.4 });
const trimMat = new THREE.MeshBasicMaterial({ color: "#f5b301", toneMapped: false });
const standMat = new THREE.MeshStandardMaterial({ color: "#2a2438", metalness: 0.3, roughness: 0.7 });
const floorMat = new THREE.MeshStandardMaterial({ color: "#8a6a4a", roughness: 0.95 });
const droneMat = new THREE.MeshStandardMaterial({ color: "#1a1a22", metalness: 0.8, roughness: 0.25, emissive: "#ef4444", emissiveIntensity: 0.6 });
const droneEye = new THREE.MeshBasicMaterial({ color: "#ff4d4d", toneMapped: false });

/** Trial gate: in the middle of the arena. */
export const TRIAL_GATE = { x: ARENA.x, z: ARENA.z };

const GATE_SPEC: NpcSpec = {
  key: "arena-trial",
  characterId: "",
  role: "The Games · 60-second trial",
  title: "a trial",
  kind: "trial",
  range: 6,
  route: { kind: "post", at: [TRIAL_GATE.x, TRIAL_GATE.z], face: 0 },
  speed: 0,
  phase: 0,
  onUse: () => startTrial(),
};

export function Arena() {
  useEffect(() => registerInteractable(GATE_SPEC, TRIAL_GATE.x, TRIAL_GATE.z), []);
  const meshes = useRef<(THREE.Object3D | null)[]>([]);
  useFrame(({ clock }) => tickTrial(clock.elapsedTime, meshes.current));

  const segments = useMemo(() => {
    const out: { a: number; gate: boolean }[] = [];
    for (let i = 0; i < ARENA_SEGMENTS; i++) out.push({ a: (i / ARENA_SEGMENTS) * Math.PI * 2, gate: arenaGate(i) });
    return out;
  }, []);
  const segLen = (2 * Math.PI * ARENA.radius) / ARENA_SEGMENTS + 0.3;

  return (
    <group>
      <group position={[ARENA.x, 0, ARENA.z]}>
        {/* sand floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={floorMat}>
          <circleGeometry args={[ARENA.radius, 64]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={trimMat}>
          <ringGeometry args={[5.6, 6, 48]} />
        </mesh>
        {/* wall with four gates, and the stands behind it */}
        {segments.map(({ a, gate }, i) => (
          <group key={i} position={[Math.sin(a) * ARENA.radius, 0, Math.cos(a) * ARENA.radius]} rotation={[0, a, 0]}>
            {gate ? (
              <>
                <mesh material={wallMat} position={[-segLen / 2, ARENA_WALL_HEIGHT / 2 + 1, 0]} scale={[0.8, ARENA_WALL_HEIGHT + 2, 1.4]}>
                  <boxGeometry />
                </mesh>
                <mesh material={wallMat} position={[segLen / 2, ARENA_WALL_HEIGHT / 2 + 1, 0]} scale={[0.8, ARENA_WALL_HEIGHT + 2, 1.4]}>
                  <boxGeometry />
                </mesh>
                <mesh material={trimMat} position={[0, ARENA_WALL_HEIGHT + 1.6, 0]} scale={[segLen + 0.8, 0.4, 1.4]}>
                  <boxGeometry />
                </mesh>
              </>
            ) : (
              <>
                <mesh material={wallMat} position={[0, ARENA_WALL_HEIGHT / 2, 0]} scale={[segLen, ARENA_WALL_HEIGHT, 1.2]}>
                  <boxGeometry />
                </mesh>
                <mesh material={trimMat} position={[0, ARENA_WALL_HEIGHT - 0.4, -0.62]} scale={[segLen, 0.12, 0.02]}>
                  <boxGeometry />
                </mesh>
                {/* stands: three tiers rising outward */}
                {[0, 1, 2].map((t) => (
                  <mesh key={t} material={standMat} position={[0, 1 + t * 2, 3 + t * 3]} scale={[segLen, 2 + t * 4, 3]}>
                    <boxGeometry />
                  </mesh>
                ))}
              </>
            )}
          </group>
        ))}
        {/* floodlights */}
        {[0.4, 2.0, 3.6, 5.2].map((a) => (
          <group key={a} position={[Math.sin(a) * (ARENA.radius + 14), 0, Math.cos(a) * (ARENA.radius + 14)]}>
            <mesh material={wallMat} position={[0, 11, 0]} scale={[0.6, 22, 0.6]}>
              <boxGeometry />
            </mesh>
            <mesh material={trimMat} position={[0, 22.4, 0]} scale={[3, 1, 3]}>
              <boxGeometry />
            </mesh>
            <pointLight position={[0, 21, 0]} color="#fff3d6" intensity={1800} distance={90} decay={2} />
          </group>
        ))}
        {/* trial gate: a glowing pedestal in the middle */}
        <mesh material={wallMat} position={[0, 0.6, 0]}>
          <cylinderGeometry args={[1.4, 1.7, 1.2, 8]} />
        </mesh>
        <mesh material={trimMat} position={[0, 1.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.25, 8]} />
        </mesh>
        <Html position={[0, 3.6, 0]} center distanceFactor={14} zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded border border-amber-400/70 bg-black/75 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-amber-300">
            Trial gate
            <div className="text-[9px] font-normal normal-case text-white/70">Press E to start a 60-second trial</div>
          </div>
        </Html>
        <Html position={[0, ARENA_WALL_HEIGHT + 9, -ARENA.radius]} center distanceFactor={40} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-lg border-2 border-amber-400 bg-[#1a0f2e]/90 px-4 py-2 text-center shadow-[0_0_30px_rgba(245,179,1,0.6)]">
            <div className="text-2xl font-black tracking-widest text-amber-300">THE ARENA</div>
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/80">BLOOD · SKILL · GLORY</div>
          </div>
        </Html>
      </group>
      {/* training drones (world space) */}
      {drones.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          visible={false}
        >
          <mesh material={droneMat}>
            <octahedronGeometry args={[DRONE_RADIUS * 0.85, 0]} />
          </mesh>
          <mesh material={droneEye} position={[0, 0, DRONE_RADIUS * 0.7]} scale={0.22}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** True once the Arena is part of the player's story (Chapter 3 started). */
export const arenaOpen = () => chapter2Done(storyStore.get());

/* ------------------------------ trial HUD ------------------------------ */

/** Countdown and score while a trial runs; a results card for a few seconds after. */
export function TrialHud() {
  const t = useSyncExternalStore(trialStore.subscribe, trialStore.get, trialStore.get);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!t.running && Date.now() - t.lastAt > 6000) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [t.running, t.lastAt]);

  if (t.running) {
    const left = Math.max(0, Math.ceil((t.endsAt - now) / 1000));
    return (
      <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
        <div className="rounded-xl border border-amber-400/60 bg-black/75 px-5 py-2 text-center text-white">
          <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300">Arena trial</div>
          <div className="flex items-baseline gap-5">
            <span className={`text-3xl font-black tabular-nums ${left <= 10 ? "text-red-400" : ""}`}>{left}s</span>
            <span className="text-3xl font-black tabular-nums text-amber-300">{t.score}</span>
          </div>
          <div className="text-[10px] text-white/60">
            drones down · {TRIAL_PASS} to pass · {TRIAL_CHAMPION} for champion
          </div>
        </div>
      </div>
    );
  }
  if (t.last >= 0 && now - t.lastAt < 6000) {
    const s = storyStore.get();
    const verdict = t.last >= TRIAL_CHAMPION ? "Champion!" : t.last >= TRIAL_PASS ? "Trial passed" : "Not this time";
    return (
      <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
        <div className="rounded-xl border border-amber-400/60 bg-black/80 px-6 py-3 text-center text-white">
          <div className="text-2xl font-black text-amber-300">{verdict}</div>
          <div className="text-sm">
            {t.last} drones · best {s.trialBest}
          </div>
          {s.sponsor && <div className="mt-1 text-[11px] text-white/60">Your sponsor&apos;s favour went up.</div>}
        </div>
      </div>
    );
  }
  return null;
}
