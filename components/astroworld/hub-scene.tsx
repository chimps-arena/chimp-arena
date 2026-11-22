"use client";

/**
 * Astroworld - live multiplayer third-person world (simulated: no wallet, no
 * items, no payments). Talks to the Colyseus "hub" room in server/.
 *
 * - Everyone is one of the real Astrochimpz NFT characters, rigged and animated.
 * - Every property from the property market stands in the world as its own
 *   building with its art, name and owner.
 * - The Core is a safe zone; out in the districts it's a shooter: mouse aim,
 *   over-the-shoulder camera, aim-down-sights, sprint/crouch/jump, recoil,
 *   reloads. Hits are decided by the server, never by the shooter's machine.
 */

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "./drei-html";
import * as THREE from "three";
import { Callbacks, Client, CloseCode, type Room } from "@colyseus/sdk";
import {
  arenaCovers,
  buildingCover,
  inArena,
  type Cover,
  shotBlockedAt,
  CHARACTERS,
  CHAT_MAX_LENGTH,
  characterById,
  characterForNftName,
  DEFAULT_CHARACTER_ID,
  DISTRICTS,
  FIRE_INTERVAL_MS,
  GRAVITY,
  HUB_SPEED,
  inSafeZone,
  MAG_SIZE,
  RELOAD_MS,
  isCharacterId,
  JUMP_VELOCITY,
  layoutProperties,
  MAX_HP,
  MOVE_SPEED,
  rayVsPlayer,
  SAFE_RADIUS,
  SHOT_RANGE,
  TIER_COLOR,
  TIER_LABEL,
  WORLD_RADIUS,
  CORE_ZONE,
  type CharacterLook,
  type HubChatBroadcast,
  type HubKillBroadcast,
  type HubMode,
  type HubRespawnMessage,
  type HubTravelBroadcast,
  type HubShotBroadcast,
  type Placement,
} from "@chimp-arena/shared";
import { idlePose, type PoseInput } from "./chimp-rig";
import { CharacterBody, fetchModelIndex, ModelIndexContext, type ModelIndex } from "./character-body";
import { Building, type WorldProperty } from "./buildings";
import { DISTRICT_HALF, SHOWROOM, STATIC_COLLIDERS, WorldLighting, WorldScenery } from "./world";
import { endTalk, npcPositions, Npcs, playerPosition, npcTalkStore, toggleTalk, trackPlayerForNpcs } from "./npcs";
import { NpcHud, type NpcContext } from "./npc-dialog";
import { registerProperties } from "./property-panel";
import { Astroburger, ASTROBURGER_COVERS } from "./astroburger";
import { FlightOverlay, Starports, STARPORT_COVERS } from "./starports";
import { Roadside, ROADSIDE_COVERS } from "./roadside";
import { WorldMap } from "./world-map";
import { audioStore, setMuted, sfx, startAudio } from "./audio";
import { Story } from "./story";
import { ObjectiveMarker, ObjectiveTracker } from "./objective";
import { Arena, arenaShot, TrialHud } from "./arena";
import { adjustRep, HIDEOUT, isDone, storyStore } from "./story-state";
import { fetchNews, NEWS_SPOTS, NewsKiosk, type NewsIndex } from "./news";
import { exchangeColliders } from "./items";
import { Effects, fx, RoverModel } from "./fx";
import { GearModel } from "./gear";
import { DrivenRover, ShowroomLot, ShowroomStar, SkyTraffic } from "./vehicles";

const SHOWROOM_ROVER = <ShowroomStar fallback={<RoverModel color="#a855f7" />} />;
const SHOWROOM_LOT = <ShowroomLot />;

/** Game server: env override, else the Fly.io deployment in production builds, else local dev. */
const SERVER_URL =
  process.env.NEXT_PUBLIC_HUB_SERVER_URL ??
  (process.env.NODE_ENV === "production" ? "https://astrochimpz-world.fly.dev" : "http://localhost:2567");
const SKIN_KEY = "astroworld:skin";

/** Client-side copy of the server's HubPlayer schema fields. */
interface NetPlayer {
  name: string;
  skin: string;
  mode: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  pitch: number;
  crouch: boolean;
  hp: number;
  alive: boolean;
  kills: number;
  deaths: number;
}

interface HubState {
  players: Map<string, NetPlayer>;
}

type Status = "connecting" | "online" | "offline";

const SEND_EVERY_MS = 66;
const BUBBLE_MS = 6000;
const ROVER_TURN = 1.7;
const ROVER_SPEED = HUB_SPEED.rover * 0.92;
const LOOK_SENS = 0.0022;
/** Buildings within this range show their sign and load their art. */
const NEAR_DISTANCE = 55;
/** Most property signs shown at once (nearest first). */
const MAX_NEAR = 5;

/* ============================== local storage ============================== */

function loadSkin(): string {
  try {
    // Only designs on the current roster (retired styles fall back to the default).
    const saved = localStorage.getItem(SKIN_KEY);
    return isCharacterId(saved) ? saved : DEFAULT_CHARACTER_ID;
  } catch {
    return DEFAULT_CHARACTER_ID;
  }
}
function saveSkin(id: string) {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    /* private mode - fine, it just won't be remembered */
  }
}

/* ============================== shared input ============================== */

/** Touch controls write here; the controller reads it each frame. */
interface TouchInput {
  move: { x: number; y: number };
  look: { dx: number; dy: number };
  fire: boolean;
  aim: boolean;
  jump: boolean;
}

/** HUD values the controller reports when they change. */
/** Camera: over the shoulder, first person, or a free orbit in front of you (see your face). */
export type CamView = "third" | "first" | "face";
const NEXT_VIEW: Record<CamView, CamView> = { third: "first", first: "face", face: "third" };

interface LocalHud {
  view: CamView;
  ammo: number;
  reloading: boolean;
  aiming: boolean;
  armed: boolean;
  locked: boolean;
  zone: string;
}

/* ============================== remote players ============================== */

function NameTag({
  name,
  look,
  bubble,
  height,
  hp,
  showHp,
  hidden = false,
}: {
  name: string;
  look: CharacterLook;
  bubble?: string;
  height: number;
  hp: number;
  showHp: boolean;
  /** Hide without unmounting - drei's Html can't safely unmount mid-render. */
  hidden?: boolean;
}) {
  const tier = TIER_COLOR[look.tier];
  return (
    <Html position={[0, height, 0]} center distanceFactor={12} zIndexRange={[10, 0]} style={{ pointerEvents: "none", display: hidden ? "none" : undefined }}>
      <div className="flex flex-col items-center gap-1 whitespace-nowrap">
        {bubble && <div className="max-w-[220px] whitespace-normal rounded-lg bg-black/80 px-2 py-1 text-center text-xs text-white shadow">{bubble}</div>}
        <div className="flex items-center gap-1.5 rounded py-0.5 pl-0.5 pr-2 text-white" style={{ background: "rgba(10,8,20,0.8)", borderBottom: `2px solid ${tier}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={look.image} alt="" className="h-6 w-6 rounded-sm object-cover" style={{ outline: `1px solid ${tier}` }} />
          <div className="leading-tight">
            <div className="text-[11px] font-semibold">{name}</div>
            <div className="text-[8px] font-bold uppercase tracking-wider" style={{ color: tier }}>
              {look.name} · {TIER_LABEL[look.tier]}
            </div>
          </div>
        </div>
        {showHp && (
          <div className="h-1 w-14 overflow-hidden rounded bg-black/60">
            <div className="h-full bg-red-500" style={{ width: `${(hp / MAX_HP) * 100}%` }} />
          </div>
        )}
      </div>
    </Html>
  );
}

function RemoteChimp({ player, bubble }: { player: NetPlayer; bubble?: string }) {
  const group = useRef<THREE.Group>(null);
  const pose = useRef<PoseInput>(idlePose());
  const placed = useRef(false);
  const [view, setView] = useState(() => ({ skin: player.skin, mode: player.mode, alive: player.alive, hp: player.hp, armed: false }));
  const look = characterById(view.skin);

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.max(rawDt, 1e-3);
    const armed = player.mode === "walk" && !inSafeZone(player.x, player.z);
    if (player.skin !== view.skin || player.mode !== view.mode || player.alive !== view.alive || player.hp !== view.hp || armed !== view.armed) {
      setView({ skin: player.skin, mode: player.mode, alive: player.alive, hp: player.hp, armed });
    }
    if (!placed.current) {
      g.position.set(player.x, player.y, player.z);
      g.rotation.y = player.ry;
      placed.current = true;
    }
    const k = 1 - Math.exp(-14 * dt);
    const px = g.position.x;
    const pz = g.position.z;
    g.position.x += (player.x - px) * k;
    g.position.z += (player.z - pz) * k;
    g.position.y += (player.y - g.position.y) * k;
    let dr = player.ry - g.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    g.rotation.y += dr * k;

    const vx = (g.position.x - px) / dt;
    const vz = (g.position.z - pz) / dt;
    const p = pose.current;
    p.speed = Math.hypot(vx, vz);
    p.forward = vx * Math.sin(g.rotation.y) + vz * Math.cos(g.rotation.y);
    p.y = g.position.y;
    p.crouch = player.crouch;
    p.pitch = player.pitch;
    p.armed = armed && player.alive;
    p.dead = !player.alive;
    p.seated = player.mode === "rover";
    p.sinceShot += dt;
  });

  useEffect(
    () =>
      fx.on((e) => {
        // Kick the rifle back when this player's shots arrive.
        if (e.kind === "flash" && group.current && Math.hypot(e.at.x - group.current.position.x, e.at.z - group.current.position.z) < 2.5) {
          pose.current.sinceShot = 0;
        }
      }),
    [],
  );

  const getPose = useCallback(() => pose.current, []);
  const rover = view.mode === "rover";
  return (
    <group ref={group}>
      {rover && <DrivenRover fallback={<RoverModel color={look.glow} />} />}
      {/* the driver rides inside the rover */}
      <group visible={!rover}>
        <CharacterBody look={look} pose={getPose} />
      </group>
      <NameTag name={player.name} look={look} bubble={bubble} height={rover ? 3.3 : 2.45} hp={view.hp} showHp={view.armed && view.hp < MAX_HP} hidden={!view.alive} />
    </group>
  );
}

/* ============================== local player ============================== */

interface LocalState {
  fov: number;
  x: number;
  z: number;
  y: number;
  vy: number;
  yaw: number;
  pitch: number;
  heading: number;
  crouch: boolean;
  ammo: number;
  reloadUntil: number;
  lastShot: number;
  firing: boolean;
  aiming: boolean;
  camInit: boolean;
  /** Metres walked since the last footstep sound. */
  stepDist: number;
  view: CamView;
  /** Face view: camera angle around the player (0 = straight in front) and its height angle. */
  orbit: number;
  orbitPitch: number;
  lastSent: { at: number; x: number; z: number; ry: number; y: number; pitch: number; crouch: boolean };
  hud: LocalHud;
}

function zoneAt(x: number, z: number): string {
  if (inSafeZone(x, z)) return CORE_ZONE;
  const d = DISTRICTS.find((dd) => Math.abs(x - dd.x) < DISTRICT_HALF && Math.abs(z - dd.z) < DISTRICT_HALF);
  return d ? d.zone : "Wastes";
}

interface LocalCtx {
  st: LocalState;
  keys: Set<string>;
  touch: TouchInput;
  me: NetPlayer;
  mode: HubMode;
  camera: THREE.Camera;
  el: HTMLElement;
  room: Room;
  colliders: Cover[];
  group: THREE.Group | null;
  /** The local character's body (hidden in first person). */
  body: THREE.Group | null;
  /** First-person rifle, placed in front of the camera each frame. */
  viewRifle: THREE.Group | null;
  pose: PoseInput;
  look: CharacterLook;
  onHud: (h: LocalHud) => void;
}

const vrOffset = new THREE.Vector3();
/** Hold the first-person rifle at the bottom right of the view (centred when aiming), with a little recoil. */
function placeViewRifle(g: THREE.Group, camera: THREE.Camera, show: boolean, aiming: boolean, sinceShot: number) {
  g.visible = show;
  if (!show) return;
  const kick = Math.max(0, 0.06 - sinceShot * 0.6);
  vrOffset.set(aiming ? 0 : 0.22, aiming ? -0.16 : -0.24, -0.55 + kick).applyQuaternion(camera.quaternion);
  g.position.copy(camera.position).add(vrOffset);
  g.quaternion.copy(camera.quaternion);
}

/** One frame of the local player: input -> movement -> shooting -> network -> camera -> HUD. */
function stepLocal(c: LocalCtx, rawDt: number) {
  const { keys: keySet, touch, me, mode, camera, el, room, colliders, pose: poseIn, look, onHud } = c;
  const dt = Math.min(rawDt, 0.1);
  const st = c.st;
  const k = keySet;
      const now = performance.now();
  const alive = me.alive;
  const rover = mode === "rover";

  // Touch look.
  st.yaw -= touch.look.dx * 0.005;
  st.pitch = THREE.MathUtils.clamp(st.pitch - touch.look.dy * 0.005, -1.2, 1.2);
  touch.look.dx = 0;
  touch.look.dy = 0;
  const aiming = (st.aiming || touch.aim) && !rover && alive;

  let fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) - touch.move.y;
  let strafe = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + touch.move.x;
  fwd = THREE.MathUtils.clamp(fwd, -1, 1);
  strafe = THREE.MathUtils.clamp(strafe, -1, 1);
  if (!alive) fwd = strafe = 0;

  let speedNow = 0;
  let forwardNow = 0;
  if (rover) {
    // Tank controls; the camera swings in behind the rover's heading.
    st.heading -= strafe * ROVER_TURN * dt * (fwd < 0 ? -1 : 1);
    const v = fwd * ROVER_SPEED * (fwd < 0 ? 0.5 : 1);
    st.x += Math.sin(st.heading) * v * dt;
    st.z += Math.cos(st.heading) * v * dt;
    let dy = st.heading - st.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    st.yaw += dy * (1 - Math.exp(-4 * dt));
    speedNow = Math.abs(v);
    st.y = 0;
    st.vy = 0;
  } else {
    const sprint = (k.has("shift") && fwd > 0 && !aiming && !st.crouch) || (touch.move.y < -0.95 && !aiming);
    const pace = st.crouch ? MOVE_SPEED.crouch : aiming ? MOVE_SPEED.aim : sprint ? MOVE_SPEED.sprint : MOVE_SPEED.walk;
    const len = Math.hypot(fwd, strafe);
    const mx = len > 1 ? strafe / len : strafe;
    const mz = len > 1 ? fwd / len : fwd;
    // Camera-relative: forward is where you look, strafe is to the right.
    const sin = Math.sin(st.yaw);
    const cos = Math.cos(st.yaw);
    const vx = (sin * mz - cos * mx) * pace;
    const vz = (cos * mz + sin * mx) * pace;
    st.x += vx * dt;
    st.z += vz * dt;
    speedNow = Math.hypot(vx, vz);
    forwardNow = mz * pace;
    st.heading = st.yaw;
    if (st.y <= 0.001 && speedNow > 0.5) {
      st.stepDist += speedNow * dt;
      const stride = st.crouch ? 1.4 : 2.1;
      if (st.stepDist >= stride) {
        st.stepDist = 0;
        sfx.step(speedNow > 7);
      }
    }

    // Jump + gravity.
    if ((k.has(" ") || touch.jump) && st.y <= 0.001 && alive) {
      st.vy = JUMP_VELOCITY;
      st.crouch = false;
      sfx.jump();
    }
    touch.jump = false;
    st.vy -= GRAVITY * dt;
    st.y = Math.max(0, st.y + st.vy * dt);
    if (st.y === 0) st.vy = 0;
  }

  // World edge and solid buildings.
  const r = Math.hypot(st.x, st.z);
  if (r > WORLD_RADIUS - 1) {
    st.x *= (WORLD_RADIUS - 1) / r;
    st.z *= (WORLD_RADIUS - 1) / r;
  }
  const bodyR = rover ? 1.8 : 0.5;
  for (const [cx, cz, cr] of colliders) {
    const dx = st.x - cx;
    const dz = st.z - cz;
    const d = Math.hypot(dx, dz);
    const min = cr + bodyR;
    if (d < min && d > 1e-6) {
      st.x = cx + (dx / d) * min;
      st.z = cz + (dz / d) * min;
    }
  }

  // If the server disagrees by a lot (rejected moves, lag), trust it.
  if (alive && Math.hypot(me.x - st.x, me.z - st.z) > 6 && now - st.lastSent.at > 600) {
    st.x = me.x;
    st.z = me.z;
  }

  const g = c.group;
  if (g) {
    g.position.set(st.x, st.y, st.z);
    g.rotation.y = st.heading;
  }

  const armed = !rover && alive && !inSafeZone(st.x, st.z);

  // Reload / fire.
  if (st.reloadUntil !== 0 && now >= st.reloadUntil) {
    st.ammo = MAG_SIZE;
    st.reloadUntil = 0;
  }
  const reloading = st.reloadUntil !== 0;
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  if ((st.firing || touch.fire) && armed && st.view !== "face" && !reloading && now - st.lastShot >= FIRE_INTERVAL_MS + 5) {
    if (st.ammo <= 0) {
      st.reloadUntil = now + RELOAD_MS;
      room.send("reload");
      sfx.dry();
      sfx.reload();
    } else {
      st.lastShot = now;
      st.ammo--;
      poseIn.sinceShot = 0;
      const spread = aiming ? 0.004 : st.crouch ? 0.012 : 0.022 + Math.min(speedNow, 9) * 0.004;
      const dir = camDir
        .clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread))
        .normalize();
      // What's under the crosshair? Nearest other player along the camera ray.
      const camPos = camera.position;
      // Arena trial drones (local practice targets).
      arenaShot(camPos, dir, SHOT_RANGE);
      const camDist = camPos.distanceTo(new THREE.Vector3(st.x, st.y + 1.4, st.z));
      let reach = SHOT_RANGE + camDist;
      (room.state as HubState).players?.forEach((p, id) => {
        if (id === room.sessionId || !p.alive) return;
        const hit = rayVsPlayer(camPos, dir, { x: p.x, y: p.y, z: p.z }, p.mode === "rover" ? 1.7 : 0.55, p.mode === "rover" ? 2.2 : 1.95);
        if (hit && hit.t > camDist && hit.t < reach) reach = hit.t;
      });
      const target = camPos.clone().addScaledVector(dir, reach);
      const right = new THREE.Vector3(-Math.cos(st.yaw), 0, Math.sin(st.yaw)).multiplyScalar(0.2);
      const muzzle = new THREE.Vector3(st.x, st.y + (st.crouch ? 1.05 : 1.42), st.z)
        .add(right)
        .add(new THREE.Vector3(Math.sin(st.yaw), 0, Math.cos(st.yaw)).multiplyScalar(0.85));
      const shotDir = target.clone().sub(muzzle).normalize();
      room.send("shoot", { o: { x: muzzle.x, y: muzzle.y, z: muzzle.z }, d: { x: shotDir.x, y: shotDir.y, z: shotDir.z } });
      // Buildings stop bullets (the server applies the same check).
      const free = Math.min(muzzle.distanceTo(target), SHOT_RANGE);
      const wall = shotBlockedAt(muzzle, shotDir, colliders, free);
      const end = muzzle.clone().addScaledVector(shotDir, wall);
      fx.emit({ kind: "flash", at: muzzle });
      sfx.shot();
      fx.emit({ kind: "tracer", from: muzzle, to: end, color: look.glow });
      if (wall < free - 0.01) fx.emit({ kind: "impact", at: end });
      // Recoil: kick up, a little sideways.
      st.pitch = Math.min(1.2, st.pitch + (aiming ? 0.006 : 0.012));
      st.yaw += (Math.random() - 0.5) * 0.006;
    }
  }

  // Animation inputs.
  const p = poseIn;
  p.speed = speedNow;
  p.forward = forwardNow;
  p.y = st.y;
  p.crouch = st.crouch && !rover;
  p.armed = armed;
  p.pitch = st.pitch;
  p.seated = rover;
  p.dead = !alive;
  p.sinceShot += dt;

  // Report to the server at a fixed rate when something changed.
  const ls = st.lastSent;
  const changed =
    Math.hypot(st.x - ls.x, st.z - ls.z) > 0.01 ||
    Math.abs(st.heading - ls.ry) > 0.01 ||
    Math.abs(st.y - ls.y) > 0.02 ||
    Math.abs(st.pitch - ls.pitch) > 0.02 ||
    st.crouch !== ls.crouch;
  if (alive && changed && now - ls.at >= SEND_EVERY_MS) {
    room.send("move", { x: st.x, z: st.z, y: st.y, ry: st.heading, pitch: st.pitch, crouch: st.crouch && !rover });
    st.lastSent = { at: now, x: st.x, z: st.z, ry: st.heading, y: st.y, pitch: st.pitch, crouch: st.crouch };
  }

  // Over-the-shoulder camera (pulled in for aim-down-sights).
  const eye = rover ? 3.2 : st.crouch ? 1.25 : 1.65;
  const back = rover ? 10 : aiming ? 1.7 : 3.4;
  const shoulder = rover ? 0 : aiming ? 0.55 : 0.75;
  const pitch = rover ? Math.min(st.pitch, 0.3) - 0.15 : st.pitch;
  const f = new THREE.Vector3(Math.sin(st.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(st.yaw) * Math.cos(pitch));
  const rightV = new THREE.Vector3(-Math.cos(st.yaw), 0, Math.sin(st.yaw));
  const pivot = new THREE.Vector3(st.x, st.y + eye, st.z);
  const view: CamView = rover ? "third" : st.view;
  const desired = pivot.clone().addScaledVector(f, -back).addScaledVector(rightV, shoulder);
  let lookAt = pivot.clone().addScaledVector(f, 30).addScaledVector(rightV, shoulder);
  if (view === "first") {
    // At the eyes, a touch forward so the head never fills the view.
    desired.copy(pivot).addScaledVector(new THREE.Vector3(Math.sin(st.yaw), 0, Math.cos(st.yaw)), 0.18);
    lookAt = desired.clone().addScaledVector(f, 30);
  } else if (view === "face") {
    // In front of you, orbiting with the mouse, looking at your face.
    const a = st.heading + st.orbit;
    const dist = 2.9;
    const face = new THREE.Vector3(st.x, st.y + (st.crouch ? 1.1 : 1.55), st.z);
    desired.set(
      face.x + Math.sin(a) * Math.cos(st.orbitPitch) * dist,
      face.y + Math.sin(st.orbitPitch) * dist,
      face.z + Math.cos(a) * Math.cos(st.orbitPitch) * dist,
    );
    lookAt = face;
  }
  desired.y = Math.max(0.4, desired.y);
  if (!st.camInit || view === "first") {
    camera.position.copy(desired);
    st.camInit = true;
  } else {
    camera.position.lerp(desired, 1 - Math.exp(-18 * dt));
  }
  camera.lookAt(lookAt);
  // First person: hide your own body (the held rifle shows instead).
  if (c.body) c.body.visible = view !== "first" && !rover;
  if (c.viewRifle) placeViewRifle(c.viewRifle, camera, view === "first" && armed, aiming, poseIn.sinceShot);
  // Dev QA only: window.__awCam = [x, y, z, lookX, lookY, lookZ] pins the camera
  // anywhere, for screenshots of distant districts (scripts/astroworld-snapshot.mjs).
  const pin = process.env.NODE_ENV !== "production" ? (globalThis as { __awCam?: number[] }).__awCam : undefined;
  if (pin) {
    camera.position.set(pin[0], pin[1], pin[2]);
    camera.lookAt(pin[3], pin[4], pin[5]);
  }
  const pc = camera as THREE.PerspectiveCamera;
  st.fov += ((aiming ? 48 : rover ? 72 : 70) - st.fov) * (1 - Math.exp(-12 * dt));
  if (Math.abs(pc.fov - st.fov) > 0.01) {
    pc.fov = st.fov;
    pc.updateProjectionMatrix();
  }

  // Tell the HUD only when something it shows changed.
  const locked = document.pointerLockElement === el;
  const zone = zoneAt(st.x, st.z);
  const h = st.hud;
  if (h.view !== view || h.ammo !== st.ammo || h.reloading !== reloading || h.aiming !== aiming || h.armed !== armed || h.locked !== locked || h.zone !== zone) {
    st.hud = { view, ammo: st.ammo, reloading, aiming, armed, locked, zone };
    onHud(st.hud);
  }
  }

function LocalPlayer({
  room,
  me,
  look,
  mode,
  bubble,
  colliders,
  getTouch,
  onHud,
  onToggleRover,
  respawnSeq,
  getRespawn,
}: {
  room: Room;
  me: NetPlayer;
  look: CharacterLook;
  mode: HubMode;
  bubble?: string;
  colliders: Cover[];
  getTouch: () => TouchInput;
  onHud: (h: LocalHud) => void;
  onToggleRover: () => void;
  respawnSeq: number;
  getRespawn: () => HubRespawnMessage | null;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const pose = useRef<PoseInput>(idlePose());
  const body = useRef<THREE.Group>(null);
  const viewRifle = useRef<THREE.Group>(null);
  const s = useRef<LocalState>({
    fov: 70,
    x: me.x,
    z: me.z,
    y: 0,
    vy: 0,
    yaw: me.ry,
    pitch: 0,
    heading: me.ry,
    crouch: false,
    ammo: MAG_SIZE,
    reloadUntil: 0,
    lastShot: 0,
    firing: false,
    aiming: false,
    camInit: false,
    stepDist: 0,
    view: "third",
    orbit: 0,
    orbitPitch: 0.1,
    lastSent: { at: 0, x: me.x, z: me.z, ry: me.ry, y: 0, pitch: 0, crouch: false },
    hud: { view: "third", ammo: -1, reloading: false, aiming: false, armed: false, locked: false, zone: "" },
  });
  const keys = useRef(new Set<string>());

  // Snap to the server's respawn point.
  useEffect(() => {
    const spot = getRespawn();
    if (!spot) return;
    const st = s.current;
    st.x = spot.x;
    st.z = spot.z;
    st.y = 0;
    st.vy = 0;
    st.yaw = st.heading = spot.ry;
    st.pitch = 0;
    st.ammo = MAG_SIZE;
    st.lastSent = { ...st.lastSent, at: performance.now(), x: spot.x, z: spot.z };
  }, [respawnSeq, getRespawn]);

  // Keyboard, mouse and pointer lock.
  useEffect(() => {
    const el = gl.domElement;
    const typing = () => {
      const a = document.activeElement;
      return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
    };
    const down = (e: KeyboardEvent) => {
      if (typing()) return;
      startAudio();
      const k = e.key.toLowerCase();
      if (k === "n" && !e.repeat) setMuted(!audioStore.get());
      if (e.repeat && (k === "c" || k === "control" || k === "f")) return;
      keys.current.add(k);
      if (k === "c" || k === "control") s.current.crouch = !s.current.crouch;
      if (k === "r" && s.current.ammo < MAG_SIZE && performance.now() > s.current.reloadUntil) {
        s.current.reloadUntil = performance.now() + RELOAD_MS;
        room.send("reload");
        sfx.reload();
      }
      if (k === "f") onToggleRover();
      if (k === "e" && !e.repeat) toggleTalk();
      if (k === "v" && !e.repeat) {
        s.current.view = NEXT_VIEW[s.current.view];
        s.current.orbit = 0;
        s.current.orbitPitch = 0.1;
      }
      if ([" ", "arrowup", "arrowdown", "tab"].includes(k)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => {
      keys.current.clear();
      s.current.firing = false;
      s.current.aiming = false;
    };
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const st = s.current;
      const sens = LOOK_SENS * (st.aiming ? 0.55 : 1);
      if (st.view === "face") {
        // Face view: the mouse swings the camera around you; you don't turn.
        st.orbit -= e.movementX * sens;
        st.orbitPitch = THREE.MathUtils.clamp(st.orbitPitch + e.movementY * sens, -0.5, 1.1);
        return;
      }
      st.yaw -= e.movementX * sens;
      st.pitch = THREE.MathUtils.clamp(st.pitch - e.movementY * sens, -1.2, 1.2);
    };
    const mdown = (e: MouseEvent) => {
      startAudio();
      if (document.pointerLockElement !== el) {
        if (e.target === el) void el.requestPointerLock();
        return;
      }
      if (e.button === 0) s.current.firing = true;
      if (e.button === 2) s.current.aiming = true;
    };
    const mup = (e: MouseEvent) => {
      if (e.button === 0) s.current.firing = false;
      if (e.button === 2) s.current.aiming = false;
    };
    const ctx = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", mdown);
    window.addEventListener("mouseup", mup);
    el.addEventListener("contextmenu", ctx);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", mdown);
      window.removeEventListener("mouseup", mup);
      el.removeEventListener("contextmenu", ctx);
    };
  }, [gl, onToggleRover, room]);

  useFrame((_, rawDt) => {
    stepLocal(
      {
        st: s.current,
        keys: keys.current,
        touch: getTouch(),
        me,
        mode,
        camera,
        el: gl.domElement,
        room,
        colliders,
        group: group.current,
        body: body.current,
        viewRifle: viewRifle.current,
        pose: pose.current,
        look,
        onHud,
      },
      rawDt,
    );
    trackPlayerForNpcs(s.current.x, s.current.z);
  });

  const getPose = useCallback(() => pose.current, []);
  return (
    <>
      {/* first-person rifle: lives in world space, moved to the camera every frame */}
      <group ref={viewRifle} visible={false}>
        <Suspense fallback={null}>
          <group rotation={[0, -Math.PI / 2, 0]}>
            <GearModel id="rifle-standard" length={0.9} />
          </group>
        </Suspense>
      </group>
      <group ref={group}>
        {mode === "rover" && <DrivenRover fallback={<RoverModel color={look.glow} />} />}
        {/* the driver rides inside the rover; hidden in first person */}
        <group ref={body}>
          <CharacterBody look={look} pose={getPose} />
        </group>
        <NameTag name={`${me.name} (you)`} look={look} bubble={bubble} height={mode === "rover" ? 3.3 : 2.45} hp={me.hp} showHp={false} hidden={!bubble} />
      </group>
    </>
  );
}

/* ============================== buildings ============================== */

function PropertyField({ props, places }: { props: WorldProperty[]; places: Map<string, Placement> }) {
  const camera = useThree((st) => st.camera);
  // E at the front of any lot opens its property panel.
  useEffect(() => registerProperties(props, places), [props, places]);
  // `near` = within sign range now; `seen` = ever been near (its label stays
  // mounted after that and is only hidden, see NameTag).
  const [view, setView] = useState<{ near: Set<string>; seen: Set<string> }>({ near: new Set(), seen: new Set() });
  const near = view.near;
  const tick = useRef(0);
  const accent = useMemo(() => {
    const m = new Map<string, string>(DISTRICTS.map((d) => [d.zone, d.accent]));
    m.set(CORE_ZONE, "#a855f7");
    return m;
  }, []);

  useFrame((_, dt) => {
    tick.current += dt;
    if (tick.current < 0.35) return;
    tick.current = 0;
    // Within range, nearest first, at most MAX_NEAR: a full district in view
    // would otherwise stack a dozen signs on top of each other.
    const inRange: [string, number][] = [];
    for (const p of props) {
      const at = places.get(p.id);
      if (!at) continue;
      const d = Math.hypot(at.x - camera.position.x, at.z - camera.position.z);
      if (d < NEAR_DISTANCE) inRange.push([p.id, d]);
    }
    inRange.sort((a, b) => a[1] - b[1]);
    const next = new Set(inRange.slice(0, MAX_NEAR).map(([id]) => id));
    if (next.size !== near.size || [...next].some((id) => !near.has(id))) {
      setView((v) => ({ near: next, seen: [...next].some((id) => !v.seen.has(id)) ? new Set([...v.seen, ...next]) : v.seen }));
    }
  });

  return (
    <>
      {props.map((p) => {
        const at = places.get(p.id);
        return at ? <Building key={p.id} prop={p} place={at} accent={accent.get(p.zone) ?? "#a855f7"} near={near.has(p.id)} labelMounted={view.seen.has(p.id)} /> : null;
      })}
    </>
  );
}

/* ============================== networking ============================== */

interface Connection {
  status: Status;
  room: Room | null;
  ids: string[];
  error: string | null;
}

const CONNECTING: Connection = { status: "connecting", room: null, ids: [], error: null };

interface Kill extends HubKillBroadcast {
  at: number;
}

function useHubRoom(name: string | undefined, initialSkin: string) {
  const [attempt, setAttempt] = useState(0);
  const [conn, setConn] = useState<Connection>(CONNECTING);
  const [chat, setChat] = useState<HubChatBroadcast[]>([]);
  const [stores] = useState(createHudStores);
  const [respawnSeq, setRespawnSeq] = useState(0);
  const respawn = useRef<HubRespawnMessage | null>(null);
  const skinRef = useRef(initialSkin);
  const autoRetries = useRef(0);
  const autoRejoins = useRef(0);

  const retry = useCallback(() => {
    autoRetries.current = 0;
    autoRejoins.current = 0;
    setConn(CONNECTING);
    setAttempt((a) => a + 1);
  }, []);
  const getRespawn = useCallback(() => respawn.current, []);
  const setJoinSkin = useCallback((skin: string) => {
    skinRef.current = skin;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let room: Room | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const joined = await new Client(SERVER_URL).joinOrCreate("hub", { name, skin: skinRef.current });
        autoRetries.current = 0;
        if (cancelled) {
          void joined.leave();
          return;
        }
        room = joined;
        const players = new Set<string>();
        const refresh = () => setConn((c) => ({ ...c, ids: [...players] }));

        const cb = Callbacks.get(joined);
        cb.onAdd("players", (_p, id) => {
          players.add(String(id));
          refresh();
        });
        cb.onRemove("players", (_p, id) => {
          players.delete(String(id));
          refresh();
        });
        joined.onMessage("chat", (line: HubChatBroadcast) => setChat((prev) => [...prev.slice(-49), line]));
        joined.onMessage("kill", (k: HubKillBroadcast) => {
          stores.kills.set([...stores.kills.get().slice(-5), { ...k, at: Date.now() }]);
          if (k.killer === joined.sessionId) {
            sfx.kill();
            stores.killAt.set(Date.now());
            const me = playerPosition();
            const sponsor = storyStore.get().sponsor;
            if (sponsor && inArena(me.x, me.z)) adjustRep(sponsor, 2);
          }
          if (k.victim === joined.sessionId) sfx.death();
        });
        joined.onMessage("shot", (shot: HubShotBroadcast) => {
          if (shot.from === joined.sessionId) {
            if (shot.hit) {
              stores.hit.set(Date.now());
              fx.emit({ kind: "impact", at: shot.end });
              sfx.hit();
            }
            return;
          }
          const shooter = (joined.state as HubState).players.get(shot.from);
          const me = (joined.state as HubState).players.get(joined.sessionId);
          if (me) {
            const dx = shot.o.x - me.x;
            const dz = shot.o.z - me.z;
            const d = Math.hypot(dx, dz) || 1;
            // +1 = to my right (right = (-cos ry, sin ry), as the camera uses).
            const side = (dx * -Math.cos(me.ry) + dz * Math.sin(me.ry)) / d;
            sfx.remoteShot(d, side);
            if (shot.hit === joined.sessionId) {
              sfx.hurt();
              stores.hurt.set({ from: Math.atan2(dx, dz), at: Date.now() });
            }
          }
          fx.emit({ kind: "flash", at: shot.o });
          fx.emit({ kind: "tracer", from: shot.o, to: shot.end, color: characterById(shooter?.skin).glow });
          if (shot.hit) fx.emit({ kind: "impact", at: shot.end });
        });
        joined.onMessage("respawn", (spot: HubRespawnMessage) => {
          respawn.current = spot;
          setRespawnSeq((n) => n + 1);
        });
        joined.onMessage("travel", (t: HubTravelBroadcast) => {
          endTalk();
          sfx.flight();
          stores.travel.set({ to: t.name, at: Date.now() });
          respawn.current = { x: t.x, z: t.z, ry: t.ry };
          setRespawnSeq((n) => n + 1);
        });
        joined.onLeave((code) => {
          if (cancelled) return;
          // Dropped for good (the SDK's own reconnect didn't make it): join again
          // quietly a few times before showing "offline". CONSENTED = left on purpose.
          if (code !== CloseCode.CONSENTED && autoRejoins.current < 5) {
            autoRejoins.current++;
            setConn((c) => ({ ...c, status: "connecting" }));
            retryTimer = setTimeout(() => setAttempt((a) => a + 1), 1000);
            return;
          }
          setConn((c) => ({ ...c, status: "offline", error: "Disconnected from Astroworld." }));
        });

        setConn({ status: "online", room: joined, ids: [...players], error: null });
      } catch (err) {
        if (cancelled) return;
        // A slow first load or a network blip shouldn't kick anyone out:
        // retry quietly a couple of times before showing "offline".
        if (autoRetries.current < 2) {
          autoRetries.current++;
          retryTimer = setTimeout(() => setAttempt((a) => a + 1), 1500);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setConn({ status: "offline", room: null, ids: [], error: `Can't reach the game server (${msg}).` });
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (room) void room.leave();
    };
  }, [name, attempt, stores]);

  return { ...conn, chat, stores, respawnSeq, getRespawn, retry, setJoinSkin };
}

/* ============================== UI pieces ============================== */

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const R = 48;
  const update = (e: React.PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / R, dy / R);
  };
  const reset = () => {
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div
      ref={base}
      className="pointer-events-auto relative h-32 w-32 touch-none rounded-full border border-white/25 bg-black/40"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => e.buttons && update(e)}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-violet-500/80" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}

const MAP_SIZE = 150;
const MAP_K = MAP_SIZE / 2 / (WORLD_RADIUS + 10);
const mapX = (x: number) => MAP_SIZE / 2 + x * MAP_K;
const mapZ = (z: number) => MAP_SIZE / 2 - z * MAP_K;

/** Districts + building dots: never change, so drawn once (memo), not 10x a second. */
const MinimapBase = memo(function MinimapBase({ places }: { places: Placement[] }) {
  return (
    <g>
      <circle cx={MAP_SIZE / 2} cy={MAP_SIZE / 2} r={SAFE_RADIUS * MAP_K} fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth={1} />
      {DISTRICTS.map((d) => (
        <rect
          key={d.zone}
          x={mapX(d.x - DISTRICT_HALF)}
          y={mapZ(d.z + DISTRICT_HALF)}
          width={DISTRICT_HALF * 2 * MAP_K}
          height={DISTRICT_HALF * 2 * MAP_K}
          fill="rgba(239,68,68,0.12)"
          stroke={d.accent}
          strokeWidth={0.8}
        />
      ))}
      {places.map((p, i) => (
        <rect key={i} x={mapX(p.x) - 1} y={mapZ(p.z) - 1} width={2} height={2} fill="#6b7280" />
      ))}
    </g>
  );
});

function Minimap({ players, meId, places }: { players: { id: string; x: number; z: number; ry: number }[]; meId: string | null; places: Placement[] }) {
  const S = MAP_SIZE;
  const tx = mapX;
  const tz = mapZ;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="h-24 w-24 rounded-full border border-violet-400/40 bg-black/85 sm:h-[150px] sm:w-[150px]">
      <MinimapBase places={places} />
      {players.map((p) =>
        p.id === meId ? (
          <g key={p.id} transform={`translate(${tx(p.x)} ${tz(p.z)}) rotate(${(-p.ry * 180) / Math.PI + 180})`}>
            <path d="M0,-5 L3.5,4 L0,2 L-3.5,4 Z" fill="#fbbf24" />
          </g>
        ) : (
          <circle key={p.id} cx={tx(p.x)} cy={tz(p.z)} r={2.2} fill="#a855f7" />
        ),
      )}
    </svg>
  );
}

function CharacterCard({ c, current, owned, onPick }: { c: CharacterLook; current: boolean; owned: boolean; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(c.id)}
      className={`group relative overflow-hidden rounded-lg border text-left transition ${current ? "border-amber-400 ring-2 ring-amber-400/60" : "border-white/10 hover:border-violet-400"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt={c.name} loading="lazy" className="aspect-square w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-semibold text-white">
        {c.name}
        {owned && <span className="ml-1 rounded bg-emerald-500/80 px-1 text-[9px] uppercase">Yours</span>}
      </div>
      <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: TIER_COLOR[c.tier] }}>
        {TIER_LABEL[c.tier]}
      </span>
    </button>
  );
}

function CharacterPicker({ current, owned, onPick, onClose }: { current: string; owned: Set<string>; onPick: (id: string) => void; onClose: () => void }) {
  const tiers: CharacterLook["tier"][] = ["one_of_one", "rare", "common"];
  const mine = CHARACTERS.filter((c) => owned.has(c.id));
  const grid = (list: CharacterLook[]) => (
    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
      {list.map((c) => (
        <CharacterCard key={c.id} c={c} current={c.id === current} owned={owned.has(c.id)} onPick={onPick} />
      ))}
    </div>
  );
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div className="max-h-full w-full max-w-4xl overflow-y-auto rounded-xl border border-violet-500/40 bg-[#110d22] p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">Choose your Astrochimp</div>
            <div className="text-xs text-white/60">Test build: try any design. Later, only NFTs you hold can be worn.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1 text-sm hover:bg-white/20">
            Close
          </button>
        </div>
        {mine.length > 0 && (
          <>
            <div className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-300">Your chimps</div>
            {grid(mine)}
          </>
        )}
        {tiers.map((tier) => (
          <div key={tier}>
            <div className="mt-4 text-xs font-bold uppercase tracking-widest" style={{ color: TIER_COLOR[tier] }}>
              {TIER_LABEL[tier]} · {CHARACTERS.filter((c) => c.tier === tier).length}
            </div>
            {grid(CHARACTERS.filter((c) => c.tier === tier))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The 3D world. Memoized and fed only stable props, so the HUD (which ticks
 * many times a second: minimap, health, ammo, kill feed) never makes React
 * re-process the whole scene - that re-processing was most of the frame cost.
 */
interface World3DProps {
  room: Room | null;
  ids: string[];
  look: CharacterLook;
  mode: HubMode;
  bubbles: Map<string, string>;
  colliders: Cover[];
  props: WorldProperty[];
  places: Map<string, Placement>;
  models: ModelIndex;
  news: NewsIndex | null;
  getTouch: () => TouchInput;
  onHud: (h: LocalHud) => void;
  onToggleRover: () => void;
  respawnSeq: number;
  getRespawn: () => HubRespawnMessage | null;
}

const World3D = memo(function World3D({
  room,
  ids,
  look,
  mode,
  bubbles,
  colliders,
  props,
  places,
  models,
  news,
  getTouch,
  onHud,
  onToggleRover,
  respawnSeq,
  getRespawn,
}: World3DProps) {
  const state = room?.state as HubState | undefined;
  return (
    <Canvas
      // isolate: drei <Html> labels use huge z-indexes; this keeps them all
      // below the HUD, map and menus, which are siblings of the canvas.
      className="!absolute inset-0 isolate z-0"
      camera={{ fov: 70, near: 0.1, far: 3200, position: [0, 20, 40] }}
      dpr={[1, 1.6]}
      gl={{ toneMappingExposure: 1.15 }}
      onCreated={({ gl, scene }) => {
        // Dev-only hooks for scripts/astroworld-snapshot.mjs (draw-call stats, perf experiments).
        if (process.env.NODE_ENV !== "production") Object.assign(window, { __awGl: gl, __awScene: scene });
      }}
    >
      <color attach="background" args={["#120c2a"]} />
      <fog attach="fog" args={["#3a2760", 160, 700]} />
      <WorldLighting />
      <ModelIndexContext.Provider value={models}>
      <WorldScenery showroomRover={SHOWROOM_ROVER} showroomLot={SHOWROOM_LOT} />
      <PropertyField props={props} places={places} />
      <Npcs props={props} places={places} />
      {news && NEWS_SPOTS.map((spot) => <NewsKiosk key={spot.key} news={news} spot={spot} />)}
      <SkyTraffic />
      <Arena />
      <ObjectiveTracker getMe={playerPosition} />
      <Astroburger />
      <Starports />
      <Roadside />
      <Effects />

      {room &&
        state &&
        ids.map((id) => {
          const p = state.players.get(id);
          if (!p) return null;
          if (id === room.sessionId) {
            return (
              <LocalPlayer
                key={id}
                room={room}
                me={p}
                look={look}
                mode={mode}
                bubble={bubbles.get(id)}
                colliders={colliders}
                getTouch={getTouch}
                onHud={onHud}
                onToggleRover={onToggleRover}
                respawnSeq={respawnSeq}
                getRespawn={getRespawn}
              />
            );
          }
          return <RemoteChimp key={id} player={p} bubble={bubbles.get(id)} />;
        })}
      </ModelIndexContext.Provider>
    </Canvas>
  );
});

/* ============================== live HUD ============================== */

/** Minimal external store: the HUD subscribes, the 3D world and network write. */
interface Store<T> {
  get: () => T;
  set: (v: T) => void;
  subscribe: (cb: () => void) => () => void;
}
function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (v: T) => {
      value = v;
      subs.forEach((cb) => cb());
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}
function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

interface HudStores {
  hud: Store<LocalHud>;
  kills: Store<Kill[]>;
  /** Last flight: where to and when (drives the flight cut-scene). */
  travel: Store<{ to: string; at: number }>;
  /** Last time I was hit, and the world direction the shot came from (atan2(dx, dz) from me). */
  hurt: Store<{ from: number; at: number }>;
  /** Last time I got a kill (kill hit marker). */
  killAt: Store<number>;
  hit: Store<number>;
}
function createHudStores(): HudStores {
  return {
    hud: createStore<LocalHud>({ view: "third", ammo: MAG_SIZE, reloading: false, aiming: false, armed: false, locked: false, zone: CORE_ZONE }),
    kills: createStore<Kill[]>([]),
    travel: createStore({ to: "", at: 0 }),
    hurt: createStore({ from: 0, at: 0 }),
    killAt: createStore(0),
    hit: createStore(0),
  };
}

/**
 * Everything on screen that changes many times a second (crosshair, health,
 * ammo, minimap, kill feed, scoreboard, death screen). It owns its own clock
 * and server-state polling, so none of that re-renders the page or the world.
 */
function LiveHud({
  room,
  status,
  online,
  propertyCount,
  placeList,
  look,
  mode,
  touch,
  picking,
  scores,
  stores,
  onToggleRover,
  onOpenPicker,
  news,
  props,
  places,
}: {
  room: Room | null;
  status: Status;
  online: number;
  propertyCount: number;
  placeList: Placement[];
  look: CharacterLook;
  mode: HubMode;
  touch: boolean;
  picking: boolean;
  scores: boolean;
  stores: HudStores;
  onToggleRover: () => void;
  onOpenPicker: () => void;
  news: NewsIndex | null;
  props: WorldProperty[];
  places: Map<string, Placement>;
}) {
  const hud = useStore(stores.hud);
  const kills = useStore(stores.kills);
  const hitAt = useStore(stores.hit);
  // World map (M).
  const [mapOpen, setMapOpen] = useState(false);
  const closeMap = useCallback(() => setMapOpen(false), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const a = document.activeElement;
      if (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) return;
      if ((e.key === "m" || e.key === "M") && !e.repeat) setMapOpen((o) => !o);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const travel = useStore(stores.travel);
  const hurt = useStore(stores.hurt);
  const killAt = useStore(stores.killAt);
  const muted = useSyncExternalStore(audioStore.subscribe, audioStore.get, audioStore.get);
  const [now, setNow] = useState(() => Date.now());
  const [snap, setSnap] = useState<Snap>({ players: [], hp: MAX_HP, alive: true });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Server-state snapshot for the HUD, 10x a second.
  useEffect(() => {
    const state = room?.state as HubState | undefined;
    if (!room || !state) return;
    const t = setInterval(() => {
      const players: Snap["players"] = [];
      state.players?.forEach((p, id) => players.push({ id, name: p.name, x: p.x, z: p.z, ry: p.ry, kills: p.kills, deaths: p.deaths }));
      const me = state.players?.get(room.sessionId);
      setSnap({ players, hp: me?.hp ?? MAX_HP, alive: me?.alive ?? true });
    }, 100);
    return () => clearInterval(t);
  }, [room]);

  const recentKills = kills.filter((k) => now - k.at < 6000);
  const killer = !snap.alive ? [...kills].reverse().find((k) => room && k.victim === room.sessionId) : undefined;
  const hitShown = now - hitAt < 300;
  const killShown = now - killAt < 700;
  // Damage direction: screen angle (clockwise from straight ahead) of whoever just hit me.
  const meSnap = room ? snap.players.find((p) => p.id === room.sessionId) : undefined;
  const hurtAge = now - hurt.at;
  const hurtAngle = meSnap ? meSnap.ry - hurt.from : 0;
  const safe = hud.zone === CORE_ZONE;
  const myStats = snap.players.find((p) => room && p.id === room.sessionId);
  const talking = useSyncExternalStore(npcTalkStore.subscribe, () => npcTalkStore.get().talking !== null, () => false);
  const npcContext: NpcContext = {
    players: snap.players,
    online,
    propertyCount,
    magSize: MAG_SIZE,
    travel: (to: string) => room?.send("travel", { to }),
  };

  return (
    <>
    {/* crosshair */}
    {room && mode === "walk" && snap.alive && hud.view === "face" && (
      <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
        <div className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          Face view · move the mouse to look around you · <b>V</b> to switch view
        </div>
      </div>
    )}
    {room && mode === "walk" && snap.alive && hud.view !== "face" && (
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {hud.armed ? (
          <div className="relative" style={{ width: hud.aiming ? 18 : 34, height: hud.aiming ? 18 : 34, transition: "all 120ms" }}>
            <span className="absolute left-1/2 top-0 h-2 w-0.5 -translate-x-1/2 bg-white/90" />
            <span className="absolute bottom-0 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-white/90" />
            <span className="absolute left-0 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-white/90" />
            <span className="absolute right-0 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-white/90" />
            <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            {killShown ? (
              <span className="absolute inset-[-14px] text-center text-4xl font-black leading-[62px] text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.9)]">✕</span>
            ) : (
              hitShown && <span className="absolute inset-[-6px] text-center text-2xl font-black leading-[46px] text-white">✕</span>
            )}
          </div>
        ) : (
          <span className="block h-1.5 w-1.5 rounded-full bg-white/70" />
        )}
      </div>
    )}

    {/* status + minimap */}
    <div className="pointer-events-none absolute left-2 top-2 z-20 flex flex-col gap-2 sm:left-3 sm:top-3">
      <div className="max-w-[46vw] rounded-lg bg-black/60 px-2 py-1.5 text-[11px] text-white sm:max-w-none sm:px-3 sm:py-2 sm:text-xs">
        <div className={`font-bold uppercase tracking-wider ${safe ? "text-emerald-300" : "text-red-400"}`}>
          {hud.zone} · {safe ? "Safe zone" : "Combat zone"}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-white/80">
          <span className={`inline-block h-2 w-2 rounded-full ${status === "online" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-red-500"}`} />
          {status === "online" ? `${online} chimp${online === 1 ? "" : "s"} online · ${propertyCount} properties` : status === "connecting" ? "Connecting…" : "Offline"}
        </div>
        <div className="mt-0.5 hidden text-[10px] text-white/50 sm:block">Test build · nothing here costs or pays anything</div>
      </div>
      {room && <Minimap players={snap.players} meId={room.sessionId} places={placeList} />}
    </div>

    {/* character + rover buttons, kill feed */}
    <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-2 sm:right-3 sm:top-3">
      <div className="flex gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onOpenPicker}
          className="flex items-center gap-2 rounded-lg border border-violet-400/60 bg-black/70 p-1 text-xs font-bold text-white hover:bg-black/90 sm:pr-3"
          aria-label={`Character: ${look.name}. Change`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={look.image} alt="" className="h-7 w-7 rounded object-cover" />
          <span className="hidden leading-tight sm:block">
            {look.name}
            <span className="block text-[9px] uppercase tracking-wider" style={{ color: TIER_COLOR[look.tier] }}>
              {TIER_LABEL[look.tier]} · change
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleRover}
          disabled={!room}
          className="rounded-lg border border-amber-400/60 bg-black/70 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-black/90 disabled:opacity-40 sm:px-3"
          aria-label={mode === "walk" ? "Rover" : "Walk"}
        >
          {mode === "walk" ? "🚙" : "🚶"}
          <span className="hidden sm:inline">{mode === "walk" ? " Rover (F)" : " Walk (F)"}</span>
        </button>
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          disabled={!room}
          className="rounded-lg border border-cyan-400/60 bg-black/70 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-black/90 disabled:opacity-40 sm:px-3"
          aria-label="Map"
        >
          🗺<span className="hidden sm:inline"> Map (M)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            startAudio();
            setMuted(!muted);
          }}
          className="rounded-lg border border-white/30 bg-black/70 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-black/90"
          aria-label={muted ? "Sound off" : "Sound on"}
          title={muted ? "Sound off (N)" : "Sound on (N)"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
      <div className="pointer-events-none flex flex-col items-end gap-1">
        {recentKills.map((k) => (
          <div key={`${k.at}-${k.victim}`} className="rounded bg-black/65 px-2 py-0.5 text-xs text-white">
            <span className="font-semibold text-amber-300">{k.killerName}</span> {k.headshot ? "🎯" : "✦"} <span className="font-semibold text-red-300">{k.victimName}</span>
          </div>
        ))}
      </div>
    </div>

    {/* health + ammo */}
    {room && (
      <div className={`pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 bottom-3`}>
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">{myStats ? `${myStats.kills} kills · ${myStats.deaths} deaths` : ""}</div>
        <div className="flex w-56 gap-1">
          {Array.from({ length: 5 }, (_, i) => {
            const fill = Math.max(0, Math.min(1, snap.hp / (MAX_HP / 5) - i));
            return (
              <div key={i} className="h-2.5 flex-1 overflow-hidden rounded-sm border border-white/20 bg-black/60">
                <div className={`h-full transition-all ${snap.hp > 40 ? "bg-emerald-400" : "bg-red-500"}`} style={{ width: `${fill * 100}%` }} />
              </div>
            );
          })}
        </div>
      </div>
    )}
    {room && hud.armed && (
      <div className="pointer-events-none absolute bottom-4 right-4 text-right text-white">
        <div className="text-3xl font-black tabular-nums">
          {hud.reloading ? "··" : hud.ammo}
          <span className="text-base text-white/50"> / {MAG_SIZE}</span>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: look.glow }}>
          {hud.reloading ? "Reloading…" : hud.ammo === 0 ? "Press R to reload" : "Astral rifle"}
        </div>
      </div>
    )}

    {/* damage direction: a red arc on the side the shot came from */}
    {room && snap.alive && hurt.at > 0 && hurtAge < 1200 && (
      <svg
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2"
        viewBox="-100 -100 200 200"
        style={{ opacity: 1 - hurtAge / 1200, transform: `translate(-50%, -50%) rotate(${(hurtAngle * 180) / Math.PI}deg)` }}
      >
        <path d="M -38 -88 A 96 96 0 0 1 38 -88" fill="none" stroke="#ef4444" strokeWidth={9} strokeLinecap="round" />
      </svg>
    )}

    {/* hurt vignette */}
    {room && snap.hp < MAX_HP && snap.alive && (
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 ${160 - snap.hp}px rgba(220,38,38,${(1 - snap.hp / MAX_HP) * 0.6})` }} />
    )}

    {/* arena trial countdown / results */}
    {room && <TrialHud />}

    {/* story: objective marker + first-visit briefing + chapter tracker */}
    {room && status === "online" && <ObjectiveMarker />}
    {room && status === "online" && !picking && <Story onArrive={stores.travel.subscribe} />}

    {/* full world map */}
    {mapOpen && room && (
      <WorldMap
        props={props}
        places={places}
        players={snap.players}
        npcs={npcPositions()}
        meId={room.sessionId}
        onClose={closeMap}
        hideout={isDone(storyStore.get(), "ch2-docks") ? HIDEOUT : null}
      />
    )}

    {/* flight cut-scene after boarding a ship */}
    {travel.at > 0 && now - travel.at < 2600 && <FlightOverlay to={travel.to} since={now - travel.at} />}

    {/* NPCs: talk prompt + conversation */}
    {room && mode === "walk" && snap.alive && !picking && <NpcHud context={npcContext} touch={touch} news={news} />}

    {/* click-to-play (desktop) */}
    {room && status === "online" && !touch && !hud.locked && !picking && snap.alive && !talking && (
      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center">
        <div className="rounded-xl border border-violet-400/40 bg-black/70 px-4 py-2 text-center text-white backdrop-blur-sm">
          <div className="text-sm font-bold">Click the world to play</div>
          <div className="mt-1 grid grid-cols-2 gap-x-6 text-left text-[11px] leading-5 text-white/70">
            <span>WASD · move</span>
            <span>Mouse · aim</span>
            <span>Shift · sprint</span>
            <span>Left click · fire</span>
            <span>Space · jump</span>
            <span>Right click · aim down sights</span>
            <span>C · crouch</span>
            <span>R · reload</span>
            <span>F · rover</span>
            <span>E · talk / use</span>
            <span>V · camera (1st person, face)</span>
            <span>M · world map</span>
            <span>N · sound on/off</span>
            <span>Tab · scoreboard</span>
            <span>Enter · chat</span>
            <span>Esc · free the mouse</span>
          </div>
          <div className="mt-1 text-[10px] text-emerald-300/80">Weapons are holstered inside the Core. Head out to a district to fight.</div>
        </div>
      </div>
    )}

    {/* scoreboard */}
    {scores && (
      <div className="pointer-events-none absolute left-1/2 top-16 w-80 -translate-x-1/2 rounded-xl border border-violet-400/40 bg-black/80 p-3 text-sm text-white">
        <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/50">
          <span>Chimp</span>
          <span>K / D</span>
        </div>
        {[...snap.players]
          .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
          .map((p) => (
            <div key={p.id} className={`flex justify-between py-0.5 ${room && p.id === room.sessionId ? "text-amber-300" : ""}`}>
              <span className="truncate">{p.name}</span>
              <span className="tabular-nums">
                {p.kills} / {p.deaths}
              </span>
            </div>
          ))}
      </div>
    )}

    {/* death */}
    {room && !snap.alive && (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-red-950/40">
        <div className="text-center text-white">
          <div className="text-3xl font-black uppercase tracking-widest text-red-400">Eliminated</div>
          {killer && (
            <div className="mt-1 text-sm">
              by {killer.killerName}
              {killer.headshot ? " · headshot" : ""}
            </div>
          )}
          <div className="mt-2 text-xs text-white/60">Respawning in the Core… (test build: nothing was lost)</div>
        </div>
      </div>
    )}
    </>
  );
}

/* ============================== the page ============================== */

interface Snap {
  players: { id: string; name: string; x: number; z: number; ry: number; kills: number; deaths: number }[];
  hp: number;
  alive: boolean;
}

export function HubScene({ playerName, loggedIn }: { playerName?: string; loggedIn: boolean }) {
  const [skin, setSkin] = useState(loadSkin);
  const { status, room, ids, error, chat, stores, respawnSeq, getRespawn, retry, setJoinSkin } = useHubRoom(playerName, skin);
  const [draft, setDraft] = useState("");
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [picking, setPicking] = useState(false);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [props, setProps] = useState<WorldProperty[]>([]);
  const [scores, setScores] = useState(false);
  // Phones: the chat box opens from a button (the joystick needs that corner).
  const [chatOpen, setChatOpen] = useState(false);
  const chatInput = useRef<HTMLInputElement>(null);
  const touchInput = useRef<TouchInput>({ move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, fire: false, aim: false, jump: false });
  const lastLook = useRef<{ x: number; y: number } | null>(null);

  const look = characterById(skin);

  // Mode is remembered per session, so a fresh join always starts on foot.
  const [modeFor, setModeFor] = useState<{ session: string; mode: HubMode } | null>(null);
  const myMode: HubMode = room && modeFor?.session === room.sessionId ? modeFor.mode : "walk";


  // Artist models that have passed scripts/check-models.mjs.
  const [models, setModels] = useState<ModelIndex>({});
  useEffect(() => {
    let live = true;
    void fetchModelIndex().then((m) => {
      if (live) setModels(m);
    });
    return () => {
      live = false;
    };
  }, []);

  // Astro-News issue for the kiosk (none published = no kiosk).
  const [news, setNews] = useState<NewsIndex | null>(null);
  useEffect(() => {
    let live = true;
    void fetchNews().then((n) => {
      if (live) setNews(n);
    });
    return () => {
      live = false;
    };
  }, []);

  // Properties from the market.
  useEffect(() => {
    let live = true;
    fetch("/api/world")
      .then((r) => r.json())
      .then((d: { properties?: WorldProperty[] }) => {
        if (live && d.properties) setProps(d.properties);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Which designs does this wallet actually hold?
  useEffect(() => {
    if (!loggedIn) return;
    let live = true;
    fetch("/api/me/assets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { nfts?: { name: string }[] }) => {
        if (!live || !d.nfts) return;
        const mine = new Set<string>();
        for (const n of d.nfts) {
          const c = characterForNftName(n.name);
          if (c) mine.add(c.id);
        }
        setOwned(mine);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [loggedIn]);

  const places = useMemo(() => layoutProperties(props), [props]);
  const placeList = useMemo(() => [...places.values()], [places]);
  // Walking obstacles and bullet cover in one list (heights stop bullets; see shared buildingCover).
  const colliders = useMemo<Cover[]>(
    () => [
      ...STATIC_COLLIDERS,
      [SHOWROOM.x, SHOWROOM.z, 4.6, 0.6],
      // parked rovers beside the showroom (see ShowroomLot)
      [SHOWROOM.x - 7.5, SHOWROOM.z + 2, 2.4, 2.4],
      [SHOWROOM.x + 7.5, SHOWROOM.z + 2, 2.4, 2.4],
      [SHOWROOM.x, SHOWROOM.z - 7.5, 2.4, 2.4],
      ...NEWS_SPOTS.map((k): Cover => [k.x, k.z, 3.2, 5.5]),
      ...ASTROBURGER_COVERS,
      ...STARPORT_COVERS,
      ...ROADSIDE_COVERS,
      ...arenaCovers(),
      ...exchangeColliders(),
      ...props.flatMap((p) => {
        const at = places.get(p.id);
        return at ? [buildingCover(at, p.type)] : [];
      }),
    ],
    [props, places],
  );

  const toggleMode = useCallback(() => {
    if (!room) return;
    const next: HubMode = myMode === "walk" ? "rover" : "walk";
    room.send("mode", { mode: next });
    setModeFor({ session: room.sessionId, mode: next });
  }, [room, myMode]);

  const openPicker = useCallback(() => {
    document.exitPointerLock?.();
    setPicking(true);
  }, []);

  const pickSkin = useCallback(
    (id: string) => {
      setSkin(id);
      saveSkin(id);
      setJoinSkin(id);
      room?.send("skin", { skin: id });
      setPicking(false);
    },
    [room, setJoinSkin],
  );

  // Enter/T = chat, Tab = scores.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (document.activeElement === chatInput.current) return;
      if (e.key === "Enter" || e.key === "t" || e.key === "T") {
        e.preventDefault();
        document.exitPointerLock?.();
        chatInput.current?.focus();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setScores(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Tab") setScores(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Speech bubbles change only when a line arrives or expires - not on the HUD clock,
  // so the 3D world isn't re-rendered several times a second for nothing.
  const [bubbleClock, setBubbleClock] = useState(() => Date.now());
  useEffect(() => {
    const expiries = chat.map((l) => l.at + BUBBLE_MS).filter((t) => t > bubbleClock);
    if (expiries.length === 0) return;
    const t = setTimeout(() => setBubbleClock(Date.now()), Math.max(50, Math.min(...expiries) - Date.now()));
    return () => clearTimeout(t);
  }, [chat, bubbleClock]);
  const bubbles = useMemo(() => {
    const out = new Map<string, string>();
    for (const line of chat) if (bubbleClock - line.at < BUBBLE_MS) out.set(line.from, line.text);
    return out;
  }, [chat, bubbleClock]);

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (room && text) room.send("chat", { text });
    setDraft("");
    chatInput.current?.blur();
    setChatOpen(false);
  };

  const getTouch = useCallback(() => touchInput.current, []);
  const setMove = useCallback((x: number, y: number) => {
    touchInput.current.move = { x, y };
  }, []);
  const setTouchFlag = useCallback((flag: "fire" | "aim" | "jump", on: boolean) => {
    touchInput.current[flag] = on;
  }, []);
  const lookStart = useCallback((e: React.PointerEvent) => {
    startAudio();
    lastLook.current = { x: e.clientX, y: e.clientY };
  }, []);
  const lookMove = useCallback((e: React.PointerEvent) => {
    const last = lastLook.current;
    if (!last) return;
    touchInput.current.look.dx += e.clientX - last.x;
    touchInput.current.look.dy += e.clientY - last.y;
    lastLook.current = { x: e.clientX, y: e.clientY };
  }, []);
  const lookEnd = useCallback(() => {
    lastLook.current = null;
  }, []);

  return (
    <div className="relative h-[calc(100dvh-140px)] min-h-[480px] w-full select-none overflow-hidden rounded-xl border border-violet-500/30 bg-[#07051a]">
      <World3D
        room={room}
        ids={ids}
        look={look}
        mode={myMode}
        bubbles={bubbles}
        colliders={colliders}
        props={props}
        places={places}
        models={models}
        news={news}
        getTouch={getTouch}
        onHud={stores.hud.set}
        onToggleRover={toggleMode}
        respawnSeq={respawnSeq}
        getRespawn={getRespawn}
      />

      <LiveHud
        room={room}
        status={status}
        online={ids.length}
        propertyCount={props.length}
        placeList={placeList}
        look={look}
        mode={myMode}
        touch={touch}
        picking={picking}
        scores={scores}
        stores={stores}
        onToggleRover={toggleMode}
        onOpenPicker={openPicker}
        news={news}
        props={props}
        places={places}
      />

      {/* chat */}
      <div className={`absolute z-20 flex flex-col gap-1.5 ${touch ? "inset-x-14 top-24" : "bottom-3 left-3 w-[min(340px,calc(100%-180px))]"}`}>
        <div className="pointer-events-none flex max-h-36 flex-col justify-end overflow-hidden text-xs">
          {chat.slice(-7).map((line) => (
            <div key={line.id} className="mb-0.5 w-fit max-w-full rounded bg-black/55 px-2 py-0.5 text-white">
              <span className="font-semibold" style={{ color: line.color }}>
                {line.name}:
              </span>{" "}
              {line.text}
            </div>
          ))}
        </div>
        <form onSubmit={sendChat} className={touch && !chatOpen ? "hidden" : undefined}>
          <input
            ref={chatInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.blur();
            }}
            onBlur={() => setChatOpen(false)}
            maxLength={CHAT_MAX_LENGTH}
            disabled={!room}
            placeholder={!room ? "Chat offline" : touch ? "Say something…" : "Chat (Enter or T)"}
            className={`w-full rounded-lg border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-violet-400 focus:outline-none ${touch ? "bg-black/95" : "bg-black/60"}`}
          />
        </form>
      </div>

      {/* touch controls */}
      {touch && room && (
        <>
          <button
            type="button"
            onClick={() => {
              setChatOpen(true);
              setTimeout(() => chatInput.current?.focus(), 0);
            }}
            className="absolute left-2 top-[11.5rem] z-20 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-sm text-white"
            aria-label="Chat"
          >
            💬
          </button>
          <div className="absolute inset-y-0 right-0 w-1/2 touch-none" onPointerDown={lookStart} onPointerMove={lookMove} onPointerUp={lookEnd} onPointerCancel={lookEnd} />
          <div className="absolute bottom-20 left-4">
            <Joystick onMove={setMove} />
          </div>
          <div className="absolute bottom-20 right-4 flex flex-col items-end gap-2">
            <button
              type="button"
              className="h-16 w-16 rounded-full bg-red-600/80 text-xs font-bold text-white"
              onPointerDown={() => setTouchFlag("fire", true)}
              onPointerUp={() => setTouchFlag("fire", false)}
              onPointerCancel={() => setTouchFlag("fire", false)}
            >
              FIRE
            </button>
            <div className="flex gap-2">
              <button type="button" className="h-12 w-12 rounded-full bg-white/20 text-[10px] font-bold text-white" onPointerDown={() => setTouchFlag("aim", true)} onPointerUp={() => setTouchFlag("aim", false)}>
                AIM
              </button>
              <button type="button" className="h-12 w-12 rounded-full bg-white/20 text-[10px] font-bold text-white" onPointerDown={() => setTouchFlag("jump", true)}>
                JUMP
              </button>
            </div>
          </div>
        </>
      )}

      {picking && <CharacterPicker current={skin} owned={owned} onPick={pickSkin} onClose={() => setPicking(false)} />}

      {/* connection problems */}
      {status === "offline" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-sm rounded-xl border border-violet-500/40 bg-[#110d22] p-5 text-center text-sm text-white">
            <div className="text-base font-bold">Astroworld is offline</div>
            <p className="mt-2 text-white/70">{error}</p>
            {process.env.NODE_ENV !== "production" && (
              <p className="mt-2 text-xs text-white/50">
                Dev tip: start the game server with <code className="text-amber-300">npm run server:dev</code>
              </p>
            )}
            <button type="button" onClick={retry} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 font-semibold hover:bg-violet-500">
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
