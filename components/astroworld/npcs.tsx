"use client";

/**
 * NPCs: the team's rigged characters on duty around Astroworld, plus the
 * companion pets in the Core. Their routes are driven by wall-clock time, so
 * every player sees each NPC in the same place without any server traffic.
 *
 * Posts follow the delivery's folders: Security guards the Core's gates,
 * Military patrols the plaza, the Weapon Specialist works the armory, the
 * Foundry hand works a foundry, the Comms Operator runs a comms tower, and
 * the Bounty Hunter stalks the open ground between the Core and the districts.
 *
 * Walk up to one and press E (or tap Talk) to talk: it stops, turns to face
 * you and opens its dialogue (npc-dialog.tsx). The talk state lives in this
 * module so the 3D scene and the HUD share it without re-rendering the world.
 *
 * NPCs can't be shot and don't block movement.
 */

import { memo, Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { characterById, ROAD_ANGLES, SAFE_RADIUS, type Placement } from "@chimp-arena/shared";
import { CharacterBody } from "./character-body";
import { idlePose, type PoseInput } from "./chimp-rig";
import { NearLabel } from "./items";
import { Pet, type PetId } from "./env-models";
import type { WorldProperty } from "./buildings";

type XZ = [number, number];

type Route =
  /** Walk A -> B, wait, walk back, wait. */
  | { kind: "line"; a: XZ; b: XZ; pause: number }
  /** Walk a circle around c. */
  | { kind: "circle"; c: XZ; r: number; dir: 1 | -1 }
  /** Stand at a spot facing a heading. */
  | { kind: "post"; at: XZ; face: number };

export interface NpcSpec {
  key: string;
  characterId: string;
  role: string;
  route: Route;
  /** Walking speed, m/s. */
  speed: number;
  /** Seconds offset so copies of one route don't move in step. */
  phase: number;
  /** Carries a rifle (security, military, bounty hunter). */
  armed?: boolean;
  /** Not a character: something to use (e.g. the Astro-News kiosk). */
  kind?: "npc" | "news";
  /** Shown in the prompt instead of the character's name. */
  title?: string;
}

/** A point `local` metres in front of/beside a building lot, in world space. */
function atLot(place: Placement, local: XZ): XZ {
  const c = Math.cos(place.ry);
  const s = Math.sin(place.ry);
  return [place.x + local[0] * c + local[1] * s, place.z - local[0] * s + local[1] * c];
}

function firstOfType(props: WorldProperty[], places: Map<string, Placement>, type: string): Placement | null {
  const p = props.filter((x) => x.type === type).sort((a, b) => a.id.localeCompare(b.id))[0];
  return p ? (places.get(p.id) ?? null) : null;
}

export function npcSpecs(props: WorldProperty[], places: Map<string, Placement>): NpcSpec[] {
  const out: NpcSpec[] = [];

  // Security: a guard pacing across each Core gate.
  ROAD_ANGLES.forEach((a, i) => {
    const r = SAFE_RADIUS - 3;
    const cx = Math.sin(a) * r;
    const cz = Math.cos(a) * r;
    const px = Math.cos(a) * 6; // across the road
    const pz = -Math.sin(a) * 6;
    out.push({
      key: `guard-${i}`,
      characterId: "std-astrogaurd-safu-security",
      role: "Astroguard · Gate security",
      route: { kind: "line", a: [cx - px, cz - pz], b: [cx + px, cz + pz], pause: 3 },
      speed: 1.6,
      phase: i * 4.3,
      armed: true,
    });
  });

  // Military: patrols the plaza between the Exchange and the property ring.
  out.push({ key: "military", characterId: "std-castro", role: "Military · Core patrol", route: { kind: "circle", c: [0, 0], r: 38, dir: 1 }, speed: 1.7, phase: 0, armed: true });

  // Bounty Hunter: stalks the open ground outside the safe zone.
  out.push({ key: "bounty", characterId: "std-death", role: "Bounty Hunter", route: { kind: "circle", c: [0, 0], r: 120, dir: -1 }, speed: 2.4, phase: 0, armed: true });

  // Workers at their buildings: pacing the front of the lot.
  const workers: [string, string, string][] = [
    ["armory", "std-weapon-specialist-ryan", "Weapon Specialist · Armory"],
    ["foundry", "std-undercover-dave", "Foundry hand"],
    ["tower", "std-techno-left-the-building", "Comms Operator"],
  ];
  for (const [type, characterId, role] of workers) {
    const place = firstOfType(props, places, type);
    if (!place) continue;
    out.push({
      key: `worker-${type}`,
      characterId,
      role,
      route: { kind: "line", a: atLot(place, [-5.5, 8]), b: atLot(place, [1.5, 8]), pause: 5 },
      speed: 1.3,
      phase: 0,
    });
  }
  return out;
}

/* ------------------------------ talking ------------------------------ */

/** Within this many metres of an NPC you can talk to it. */
export const TALK_RANGE = 4.5;

export interface NpcTalkState {
  /** NPC close enough to talk to (key), if any. */
  near: string | null;
  /** NPC being talked to (key), if any. */
  talking: string | null;
}

interface NpcRuntime {
  spec: NpcSpec;
  x: number;
  z: number;
  /** Seconds the NPC's route clock has been held back (it pauses while talking). */
  offset: number;
}

const live = new Map<string, NpcRuntime>();
const player = { x: 0, z: 0 };
let talk: NpcTalkState = { near: null, talking: null };
const talkSubs = new Set<() => void>();

function setTalk(next: NpcTalkState) {
  if (next.near === talk.near && next.talking === talk.talking) return;
  talk = next;
  talkSubs.forEach((cb) => cb());
}

export const npcTalkStore = {
  get: (): NpcTalkState => talk,
  subscribe: (cb: () => void) => {
    talkSubs.add(cb);
    return () => void talkSubs.delete(cb);
  },
};

/**
 * Something fixed in the world you can use with E, like an NPC you talk to
 * (the news kiosk). Returns the unregister function.
 */
export function registerInteractable(spec: NpcSpec, x: number, z: number): () => void {
  live.set(spec.key, { spec, x, z, offset: 0 });
  return () => void live.delete(spec.key);
}

export function npcSpec(key: string | null): NpcSpec | null {
  return key ? (live.get(key)?.spec ?? null) : null;
}

/** Called every frame with the local player's position: finds who's in talking range. */
export function trackPlayerForNpcs(x: number, z: number) {
  // Dev QA only: window.__awNpcQa = "<npc key>" pretends the player stands next to that NPC.
  const qa = process.env.NODE_ENV !== "production" ? (globalThis as { __awNpcQa?: string }).__awNpcQa : undefined;
  const target = qa ? live.get(qa) : undefined;
  if (target) {
    x = target.x + 2;
    z = target.z + 2;
  }
  player.x = x;
  player.z = z;
  let near: string | null = null;
  let best = TALK_RANGE;
  for (const [key, n] of live) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < best) {
      best = d;
      near = key;
    }
  }
  let talking = talk.talking;
  // Walking away ends the conversation.
  if (talking) {
    const n = live.get(talking);
    if (!n || Math.hypot(n.x - x, n.z - z) > TALK_RANGE + 3) talking = null;
  }
  setTalk({ near, talking });
}

/** E key / Talk button: start talking to the nearby NPC, or stop. Returns true if a talk started. */
export function toggleTalk(): boolean {
  if (talk.talking) {
    setTalk({ ...talk, talking: null });
    return false;
  }
  if (talk.near) {
    setTalk({ ...talk, talking: talk.near });
    return true;
  }
  return false;
}

export function endTalk() {
  if (talk.talking) setTalk({ ...talk, talking: null });
}

/* ------------------------------ movement ------------------------------ */

/** Move an NPC along its route; it pauses and faces the player while being talked to. */
function stepNpc(rt: NpcRuntime, dt: number, g: THREE.Group | null, pose: PoseInput) {
  if (!g) return;
  const spec = rt.spec;
  const talking = talk.talking === spec.key;
  if (talking) rt.offset -= dt; // hold the route clock still
  const t = Date.now() / 1000 + spec.phase + rt.offset;
  const r = spec.route;
  let x = 0;
  let z = 0;
  let heading = 0;
  let moving = false;
  if (r.kind === "post") {
    [x, z] = r.at;
    heading = r.face;
  } else if (r.kind === "circle") {
    const ang = ((t * spec.speed) / r.r) * r.dir;
    x = r.c[0] + Math.sin(ang) * r.r;
    z = r.c[1] + Math.cos(ang) * r.r;
    heading = ang + (r.dir * Math.PI) / 2;
    moving = true;
  } else {
    const dx = r.b[0] - r.a[0];
    const dz = r.b[1] - r.a[1];
    const len = Math.hypot(dx, dz) || 1;
    const leg = len / spec.speed;
    const cycle = 2 * (leg + r.pause);
    const u = ((t % cycle) + cycle) % cycle;
    let f: number;
    if (u < leg) {
      f = u / leg;
      heading = Math.atan2(dx, dz);
      moving = true;
    } else if (u < leg + r.pause) {
      f = 1;
      heading = Math.atan2(dx, dz) + 2.6; // turned half back, looking around
    } else if (u < 2 * leg + r.pause) {
      f = 1 - (u - leg - r.pause) / leg;
      heading = Math.atan2(-dx, -dz);
      moving = true;
    } else {
      f = 0;
      heading = Math.atan2(-dx, -dz) + 2.6;
    }
    x = r.a[0] + dx * f;
    z = r.a[1] + dz * f;
  }
  if (talking) {
    heading = Math.atan2(player.x - x, player.z - z);
    moving = false;
  }
  rt.x = x;
  rt.z = z;
  g.position.set(x, 0, z);
  // Ease the turn so pauses don't snap.
  const d = Math.atan2(Math.sin(heading - g.rotation.y), Math.cos(heading - g.rotation.y));
  g.rotation.y += d * 0.12;
  pose.speed = moving ? spec.speed : 0;
  pose.armed = !!spec.armed;
  pose.forward = pose.speed;
}

const Npc = memo(function Npc({ spec }: { spec: NpcSpec }) {
  const group = useRef<THREE.Group>(null);
  const pose = useMemo<PoseInput>(() => idlePose(), []);
  const look = useMemo(() => characterById(spec.characterId), [spec.characterId]);
  const getPose = useMemo(() => () => pose, [pose]);
  const rt = useMemo<NpcRuntime>(() => ({ spec, x: 0, z: 0, offset: 0 }), [spec]);
  useEffect(() => {
    live.set(spec.key, rt);
    return () => void live.delete(spec.key);
  }, [spec.key, rt]);
  // Wall-clock time keeps every player's view of the NPC in step.
  useFrame((_, dt) => stepNpc(rt, Math.min(dt, 0.1), group.current, pose));
  return (
    <group ref={group}>
      <Suspense fallback={null}>
        <CharacterBody look={look} pose={getPose} />
      </Suspense>
      <NearLabel title={look.name} sub={`NPC · ${spec.role}`} color="#f59e0b" y={2.45} within={26} />
    </group>
  );
});

const PETS: { id: PetId; at: XZ; size: number; label: string }[] = [
  { id: "astrodog", at: [-17, 28], size: 0.75, label: "Astrodog" },
  { id: "astrokitty", at: [19, 27], size: 0.6, label: "Astrokitty" },
];

export const Npcs = memo(function Npcs({ props, places }: { props: WorldProperty[]; places: Map<string, Placement> }) {
  const specs = useMemo(() => npcSpecs(props, places), [props, places]);
  return (
    <group>
      {specs.map((s) => (
        <Npc key={s.key} spec={s} />
      ))}
      {PETS.map((p) => (
        <group key={p.id} position={[p.at[0], 0, p.at[1]]}>
          <Suspense fallback={null}>
            <Pet id={p.id} size={p.size} radius={3} speed={0.3} />
          </Suspense>
          <NearLabel title={p.label} sub="Companion pet" color="#22d3ee" y={1.6} within={16} />
        </group>
      ))}
    </group>
  );
});
