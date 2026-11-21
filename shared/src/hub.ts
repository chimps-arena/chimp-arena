/**
 * Astroworld - rules the client (feel) and the HubRoom server (validation)
 * both read, so the two can't drift apart.
 *
 * Simulated build: no wallet, no items, no payments. The Core is a safe zone
 * (no weapons); the districts around it allow combat. Dying only respawns you
 * in the Core - no loot is lost yet.
 */
import { SAFE_RADIUS, WORLD_RADIUS } from "./world-layout";

/** Max players per world instance before the matchmaker opens another. */
export const HUB_MAX_PLAYERS = 40;

export type HubMode = "walk" | "rover";

/** Metres per second - the server's speed cap per mode (walk includes sprint). */
export const HUB_SPEED: Record<HubMode, number> = {
  walk: 9.5,
  rover: 26,
};

/** On-foot speeds the client actually uses (all under the cap). */
export const MOVE_SPEED = { crouch: 2.6, walk: 5.2, sprint: 8.6, aim: 3.4 } as const;
export const JUMP_VELOCITY = 6.2;
export const GRAVITY = 18;
/** Highest a reported y can be (jump apex + slack). */
export const MAX_Y = 2.5;

export const CHAT_MAX_LENGTH = 140;
/** At most this many chat lines per player inside CHAT_WINDOW_MS. */
export const CHAT_BURST = 4;
export const CHAT_WINDOW_MS = 8000;

export const NAME_MAX_LENGTH = 20;

/* ---------------------------------- combat ---------------------------------- */

export const MAX_HP = 100;
export const SHOT_DAMAGE = 20;
/** Headshots (top of the capsule) hit harder, like any shooter. */
export const HEADSHOT_DAMAGE = 45;
export const FIRE_INTERVAL_MS = 110;
export const SHOT_RANGE = 160;
/** Where the server lets a shot start relative to the shooter's known position. */
export const MUZZLE_SLACK = 3;
export const RESPAWN_MS = 2500;

/** Player hit capsule, from feet (y) up. */
export const BODY_RADIUS = 0.55;
export const BODY_HEIGHT = 1.95;
export const HEAD_FROM = 1.55;

export function inWorld(x: number, z: number): boolean {
  return x * x + z * z <= WORLD_RADIUS * WORLD_RADIUS;
}

export function inSafeZone(x: number, z: number): boolean {
  return x * x + z * z <= SAFE_RADIUS * SAFE_RADIUS;
}

/** Trim, collapse whitespace, strip control characters, cap length. Empty -> null. */
export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  return text.length > 0 ? text : null;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Distance along a ray (origin o, unit direction d) to a player's vertical
 * capsule, or null on a miss. Also says whether it was the head.
 */
export function rayVsPlayer(
  o: Vec3,
  d: Vec3,
  p: Vec3,
  radius = BODY_RADIUS,
  height = BODY_HEIGHT,
): { t: number; head: boolean } | null {
  // Closest approach between the ray and the capsule's vertical axis, in the XZ plane.
  const ox = o.x - p.x;
  const oz = o.z - p.z;
  const a = d.x * d.x + d.z * d.z;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - radius * radius;
  if (a < 1e-9) {
    // Shooting straight up/down: hit only if already inside the cylinder.
    return c <= 0 ? { t: 0, head: false } : null;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    if (t < 0) continue;
    const y = o.y + d.y * t - p.y;
    if (y >= 0 && y <= height) return { t, head: y >= HEAD_FROM };
  }
  return null;
}

/* --------------------------------- messages --------------------------------- */

/** Client -> server: where I am now (validated against the speed cap and the world disc). */
export interface HubMoveMessage {
  x: number;
  z: number;
  /** Feet height above ground (jumping) - visual, clamped. */
  y?: number;
  /** Body heading (radians). */
  ry: number;
  /** Aim pitch (radians) - so others see where you point. */
  pitch?: number;
  crouch?: boolean;
}

/** Client -> server: switch between walking and the (free, simulated) rover. */
export interface HubModeMessage {
  mode: HubMode;
}

/** Client -> server: wear one of the NFT character designs. */
export interface HubSkinMessage {
  skin: string;
}

export interface HubChatMessage {
  text: string;
}

/** Client -> server: I fired. The server decides what (if anything) it hit. */
export interface HubShootMessage {
  o: Vec3;
  d: Vec3;
}

/** Server -> every client: draw this shot (tracer from o to end). */
export interface HubShotBroadcast {
  from: string;
  o: Vec3;
  end: Vec3;
  hit: string | null;
}

/** Server -> every client: kill feed line. */
export interface HubKillBroadcast {
  killer: string;
  killerName: string;
  victim: string;
  victimName: string;
  headshot: boolean;
}

/** Server -> one client: you respawned here. */
export interface HubRespawnMessage {
  x: number;
  z: number;
  ry: number;
}

/** Server -> every client: one chat line. */
export interface HubChatBroadcast {
  id: string;
  /** Sender's session id - which avatar gets the speech bubble. */
  from: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export interface HubJoinOptions {
  name?: string;
  skin?: string;
}
