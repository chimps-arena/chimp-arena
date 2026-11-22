/**
 * Astroworld - the live world (simulated: no wallet, no items, no payments).
 *
 * Server-authoritative like MiningRoom:
 * - every move is checked against the speed cap for the player's mode and
 *   the world disc;
 * - shots are resolved here, not on the shooter's machine: fire rate, range,
 *   muzzle position and the safe zone are all enforced, then the server
 *   raycasts against where it knows everyone is;
 * - chat is length-capped, rate-limited and profanity-masked;
 * - characters must be one of the real NFT designs.
 *
 * Names and characters are display-only for now - tying them to a signed-in
 * wallet's owned NFTs comes with real inventories.
 */
import { Client, Room } from "@colyseus/core";
import { worldCovers, worldDocks } from "../world-covers";
import { schema, t } from "@colyseus/schema";
import { englishDataset, englishRecommendedTransformers, RegExpMatcher, TextCensor } from "obscenity";
import {
  CHAT_BURST,
  CHAT_MAX_LENGTH,
  CHAT_WINDOW_MS,
  characterById,
  cleanText,
  DEFAULT_CHARACTER_ID,
  FIRE_INTERVAL_MS,
  MAG_SIZE,
  RELOAD_MS,
  RELOAD_SLACK_MS,
  HEADSHOT_DAMAGE,
  HUB_MAX_PLAYERS,
  HUB_SPEED,
  inSafeZone,
  inWorld,
  isCharacterId,
  MAX_HP,
  MAX_Y,
  MUZZLE_SLACK,
  NAME_MAX_LENGTH,
  arrivalSpot,
  BOARD_RANGE,
  rayVsPlayer,
  RESPAWN_MS,
  STARPORTS,
  TRAVEL_COOLDOWN_MS,
  shotBlockedAt,
  groundHeight,
  terrainBlockedAt,
  SAFE_RADIUS,
  SHOT_DAMAGE,
  SHOT_RANGE,
} from "@chimp-arena/shared";
import type {
  HubChatBroadcast,
  HubChatMessage,
  HubJoinOptions,
  HubKillBroadcast,
  HubMode,
  HubModeMessage,
  HubMoveMessage,
  HubRespawnMessage,
  HubTravelBroadcast,
  HubTravelMessage,
  HubShootMessage,
  HubShotBroadcast,
  HubSkinMessage,
  Vec3,
} from "@chimp-arena/shared";

export const HubPlayer = schema(
  {
    name: t.string().default(""),
    skin: t.string().default(DEFAULT_CHARACTER_ID),
    mode: t.string().default("walk"),
    x: t.number().default(0),
    y: t.number().default(0),
    z: t.number().default(0),
    ry: t.number().default(0),
    pitch: t.number().default(0),
    crouch: t.boolean().default(false),
    hp: t.number().default(MAX_HP),
    alive: t.boolean().default(true),
    kills: t.number().default(0),
    deaths: t.number().default(0),
  },
  "HubPlayer",
);

export const HubRoomState = schema(
  {
    players: t.map(HubPlayer),
  },
  "HubRoomState",
);

type HubPlayerT = InstanceType<typeof HubPlayer>;

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
const censor = new TextCensor();

function clean(text: string): string {
  return censor.applyTo(text, matcher.getAllMatches(text));
}

const finite = (...v: unknown[]) => v.every((n) => typeof n === "number" && Number.isFinite(n));
const vec = (v: unknown): v is Vec3 => !!v && finite((v as Vec3).x, (v as Vec3).y, (v as Vec3).z);

interface Track {
  lastMoveAt: number;
  lastTravelAt: number;
  lastShotAt: number;
  /** Rounds left in the magazine, as the server counts them. */
  ammo: number;
  /** Reload finishes at this time (0 = not reloading). */
  reloadUntil: number;
  chatTimes: number[];
}

/** A random spot in the Core, facing roughly outward. */
export function spawnPoint(): HubRespawnMessage {
  const angle = Math.random() * Math.PI * 2;
  const r = SAFE_RADIUS * (0.22 + Math.random() * 0.2);
  return { x: Math.sin(angle) * r, z: Math.cos(angle) * r, ry: angle };
}

/**
 * Hard cap on simultaneous Astroworld instances on this server (x40 players
 * each), so a flood of join requests can't spin up rooms until it falls over.
 */
export const MAX_HUB_ROOMS = Number(process.env.MAX_HUB_ROOMS ?? 25);
/** How long a dropped player's spot is held for them to reconnect. */
export const RECONNECT_SECONDS = 20;
let openRooms = 0;
const liveRooms = new Set<HubRoom>();

/** Open Astroworld instances and players across them (for /health and load tests). */
export function hubStats(): { rooms: number; players: number } {
  let players = 0;
  for (const r of liveRooms) players += r.clients.length;
  return { rooms: liveRooms.size, players };
}

export class HubRoom extends Room<{ state: InstanceType<typeof HubRoomState> }> {
  maxClients = HUB_MAX_PLAYERS;
  /**
   * Seconds a matched player has to open the room connection. The 3D world
   * is heavy to start (on slow phones the page can be busy for a while after
   * matchmaking), so the default window was too short and players got
   * "seat reservation expired".
   */
  seatReservationTimeout = 45;
  private counted = false;

  private tracks = new WeakMap<HubPlayerT, Track>();
  private chatSeq = 0;

  onCreate(): void {
    if (openRooms >= MAX_HUB_ROOMS) throw new Error("Astroworld is full right now - try again in a minute");
    openRooms++;
    this.counted = true;
    liveRooms.add(this);
    this.state = new HubRoomState();

    this.onMessage("move", (client, msg: HubMoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      const track = player && this.tracks.get(player);
      if (!player || !track || !player.alive) return;
      if (!finite(msg?.x, msg?.z, msg?.ry)) return;
      if (!inWorld(msg.x, msg.z)) return;

      const now = Date.now();
      const elapsed = Math.max(0, (now - track.lastMoveAt) / 1000);
      const maxDist = HUB_SPEED[player.mode as HubMode] * elapsed + 0.5; // slack for network jitter
      if (Math.hypot(msg.x - player.x, msg.z - player.z) > maxDist) return;

      player.x = msg.x;
      player.z = msg.z;
      player.ry = msg.ry;
      player.y = finite(msg.y) ? Math.min(Math.max(msg.y!, 0), MAX_Y) : 0;
      player.pitch = finite(msg.pitch) ? Math.min(Math.max(msg.pitch!, -1.4), 1.4) : 0;
      player.crouch = msg.crouch === true && player.mode === "walk";
      track.lastMoveAt = now;
    });

    this.onMessage("travel", (client, msg: HubTravelMessage) => this.travel(client, msg));

    this.onMessage("mode", (client, msg: HubModeMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;
      if (msg?.mode === "walk" || msg?.mode === "rover") player.mode = msg.mode;
    });

    this.onMessage("skin", (client, msg: HubSkinMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (player && isCharacterId(msg?.skin)) player.skin = msg.skin;
    });

    this.onMessage("shoot", (client, msg: HubShootMessage) => this.shoot(client, msg));
    this.onMessage("reload", (client) => {
      const player = this.state.players.get(client.sessionId);
      const track = player && this.tracks.get(player);
      if (!track || track.reloadUntil !== 0 || track.ammo >= MAG_SIZE) return;
      track.reloadUntil = Date.now() + RELOAD_MS;
    });

    this.onMessage("chat", (client, msg: HubChatMessage) => {
      const player = this.state.players.get(client.sessionId);
      const track = player && this.tracks.get(player);
      if (!player || !track) return;
      const text = cleanText(msg?.text, CHAT_MAX_LENGTH);
      if (!text) return;

      const now = Date.now();
      track.chatTimes = track.chatTimes.filter((at) => now - at < CHAT_WINDOW_MS);
      if (track.chatTimes.length >= CHAT_BURST) return; // spamming - drop silently
      track.chatTimes.push(now);

      const line: HubChatBroadcast = {
        id: `${this.roomId}-${++this.chatSeq}`,
        from: client.sessionId,
        name: player.name,
        color: characterById(player.skin).glow,
        text: clean(text),
        at: now,
      };
      this.broadcast("chat", line);
    });
  }

  /**
   * Fly a player between starports. Only from a ship: within BOARD_RANGE of a
   * starport pad or a dock lot, alive, on foot, not too soon after the last
   * flight. The server moves them, so nobody can teleport by faking moves.
   */
  private travel(client: Client, msg: HubTravelMessage): void {
    const player = this.state.players.get(client.sessionId);
    const track = player && this.tracks.get(player);
    if (!player || !track || !player.alive || player.mode !== "walk") return;
    const dest = STARPORTS.find((s) => s.id === msg?.to);
    if (!dest) return;
    const now = Date.now();
    if (now - track.lastTravelAt < TRAVEL_COOLDOWN_MS) return;
    const near = (x: number, z: number) => Math.hypot(player.x - x, player.z - z) <= BOARD_RANGE;
    const from = STARPORTS.find((s) => near(s.x, s.z));
    if (!from && !worldDocks().some((d) => near(d.x, d.z))) return;
    if (from?.id === dest.id) return;

    const spot = arrivalSpot(dest);
    player.x = spot.x;
    player.z = spot.z;
    player.y = 0;
    player.ry = spot.ry;
    track.lastTravelAt = now;
    track.lastMoveAt = now;
    const arrived: HubTravelBroadcast = { to: dest.id, name: dest.name, ...spot };
    client.send("travel", arrived);
  }

  private shoot(client: Client, msg: HubShootMessage): void {
    const shooter = this.state.players.get(client.sessionId);
    const track = shooter && this.tracks.get(shooter);
    if (!shooter || !track || !shooter.alive || shooter.mode !== "walk") return;
    if (!vec(msg?.o) || !vec(msg?.d)) return;
    if (inSafeZone(shooter.x, shooter.z)) return; // weapons are holstered in the Core

    const now = Date.now();
    if (now - track.lastShotAt < FIRE_INTERVAL_MS) return;
    // Ammo, counted here so a modified client can't fire forever.
    if (track.reloadUntil !== 0) {
      if (now < track.reloadUntil - RELOAD_SLACK_MS) return;
      track.ammo = MAG_SIZE;
      track.reloadUntil = 0;
    }
    if (track.ammo <= 0) {
      track.reloadUntil = now + RELOAD_MS;
      return;
    }
    track.ammo--;
    track.lastShotAt = now;

    // The shot must start at (roughly) the shooter, not wherever they claim.
    const { o } = msg;
    const shooterGround = groundHeight(shooter.x, shooter.z);
    if (Math.hypot(o.x - shooter.x, o.z - shooter.z) > MUZZLE_SLACK || o.y < shooterGround - 0.5 || o.y > shooterGround + MAX_Y + 3) return;
    const len = Math.hypot(msg.d.x, msg.d.y, msg.d.z);
    if (len < 1e-6) return;
    const d = { x: msg.d.x / len, y: msg.d.y / len, z: msg.d.z / len };

    // Buildings stop bullets: nobody behind a wall can be hit through it.
    const wall = Math.min(shotBlockedAt(o, d, worldCovers(), SHOT_RANGE), terrainBlockedAt(o, d, SHOT_RANGE));
    let best: { id: string; t: number; head: boolean } | null = null;
    this.state.players.forEach((target, id) => {
      if (id === client.sessionId || !target.alive) return;
      const rover = target.mode === "rover";
      const ty = groundHeight(target.x, target.z) + target.y;
      const hit = rayVsPlayer(o, d, { x: target.x, y: ty, z: target.z }, rover ? 1.7 : 0.55, rover ? 2.2 : target.crouch ? 1.45 : 1.95);
      if (hit && hit.t <= wall && (!best || hit.t < best.t)) best = { id, t: hit.t, head: hit.head && !rover };
    });

    const hitInfo = best as { id: string; t: number; head: boolean } | null;
    const reach = hitInfo ? hitInfo.t : wall;
    const shot: HubShotBroadcast = {
      from: client.sessionId,
      o,
      end: { x: o.x + d.x * reach, y: o.y + d.y * reach, z: o.z + d.z * reach },
      hit: null,
    };

    if (hitInfo) {
      const target = this.state.players.get(hitInfo.id)!;
      // Players standing in the Core can't be hurt, even from outside it.
      if (!inSafeZone(target.x, target.z)) {
        shot.hit = hitInfo.id;
        target.hp = Math.max(0, target.hp - (hitInfo.head ? HEADSHOT_DAMAGE : SHOT_DAMAGE));
        if (target.hp === 0) this.kill(shooter, client.sessionId, target, hitInfo.id, hitInfo.head);
      }
    }
    this.broadcast("shot", shot);
  }

  private kill(killer: HubPlayerT, killerId: string, victim: HubPlayerT, victimId: string, headshot: boolean): void {
    killer.kills++;
    victim.deaths++;
    victim.alive = false;
    const line: HubKillBroadcast = { killer: killerId, killerName: killer.name, victim: victimId, victimName: victim.name, headshot };
    this.broadcast("kill", line);

    this.clock.setTimeout(() => {
      const still = this.state.players.get(victimId);
      if (!still) return;
      const spot = spawnPoint();
      still.x = spot.x;
      still.z = spot.z;
      still.ry = spot.ry;
      still.y = 0;
      still.mode = "walk";
      still.hp = MAX_HP;
      still.alive = true;
      const track = this.tracks.get(still);
      if (track) {
        track.lastMoveAt = Date.now();
        track.ammo = MAG_SIZE;
        track.reloadUntil = 0;
      }
      this.clients.getById(victimId)?.send("respawn", spot);
    }, RESPAWN_MS);
  }

  onJoin(client: Client, options?: HubJoinOptions): void {
    const player = new HubPlayer();
    const name = cleanText(options?.name, NAME_MAX_LENGTH);
    player.name = name && !matcher.hasMatch(name) ? name : `Chimp-${client.sessionId.slice(0, 4)}`;
    if (isCharacterId(options?.skin)) player.skin = options.skin;

    const spot = spawnPoint();
    player.x = spot.x;
    player.z = spot.z;
    player.ry = spot.ry;

    this.state.players.set(client.sessionId, player);
    this.tracks.set(player, { lastMoveAt: Date.now(), lastTravelAt: 0, lastShotAt: 0, ammo: MAG_SIZE, reloadUntil: 0, chatTimes: [] });
  }

  /**
   * Unexpected disconnect (phone switching networks, Wi-Fi blip): keep the
   * player in the world and hold their place for RECONNECT_SECONDS. The
   * client SDK reconnects on its own; if it doesn't make it, onLeave runs.
   */
  onDrop(client: Client): void {
    // Rejects with "not joined" when the drop hits a client that was itself
    // still (re)connecting - e.g. a reconnect attempt that dropped again on a
    // bad network. Nothing to hold then: the player leaves and the client
    // joins fresh (see the client's auto-rejoin).
    this.allowReconnection(client, RECONNECT_SECONDS).catch(() => {});
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    const track = player && this.tracks.get(player);
    if (track) track.lastMoveAt = Date.now();
  }

  /** Left for good: closed the page, or the reconnect window ran out. */
  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }

  onDispose(): void {
    liveRooms.delete(this);
    if (this.counted) openRooms--;
  }
}
