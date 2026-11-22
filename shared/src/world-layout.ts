/**
 * Where every property-market property stands in Astroworld.
 *
 * Deterministic: the same property list always gives the same layout, so all
 * players (and later the server, for collisions/ownership checks) agree on
 * where a building is without storing coordinates anywhere.
 *
 * Astroworld Core is the safe-zone plaza in the middle; its properties ring
 * the plaza. The other three zones are districts out past the safe-zone wall,
 * reached by road - that's where combat is allowed.
 */

export interface District {
  zone: string;
  /** District centre, metres from the world origin. */
  x: number;
  z: number;
  /** Ground tint + neon accent for the district. */
  ground: string;
  accent: string;
}

export const SAFE_RADIUS = 70;
export const WORLD_RADIUS = 330;

const DISTRICT_DISTANCE = 205;
const at = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a) * DISTRICT_DISTANCE, z: Math.cos(a) * DISTRICT_DISTANCE };
};

export const DISTRICTS: District[] = [
  { zone: "The Belt", ...at(0), ground: "#2a1f1a", accent: "#f97316" },
  { zone: "Lunar Rim", ...at(120), ground: "#24242b", accent: "#cbd5e1" },
  { zone: "Helios Docks", ...at(240), ground: "#2b2216", accent: "#f5b301" },
];

export const CORE_ZONE = "Astroworld Core";
/** Core properties stand on this ring, facing the tower. */
export const CORE_RING = 56;
/** Lot pitch inside a district grid (building footprint + street). */
export const LOT_SPACING = 26;
/** Radius used for walking collisions around a building. */
export const BUILDING_RADIUS = 7;

export interface Placement {
  x: number;
  z: number;
  /** Facing (radians, Y axis) - the building's front looks this way. */
  ry: number;
}

/** id -> placement for every property, grouped and sorted so it never shuffles. */
export function layoutProperties(props: { id: string; zone: string }[]): Map<string, Placement> {
  const out = new Map<string, Placement>();
  const byZone = new Map<string, string[]>();
  for (const p of props) {
    const zone = p.zone === CORE_ZONE || DISTRICTS.some((d) => d.zone === p.zone) ? p.zone : DISTRICTS[0].zone;
    byZone.set(zone, [...(byZone.get(zone) ?? []), p.id]);
  }

  const core = (byZone.get(CORE_ZONE) ?? []).sort();
  core.forEach((id, i) => {
    // Leave a gap at each road exit so the ring doesn't block the way out.
    const a = slotAngle(i, core.length);
    const x = Math.sin(a) * CORE_RING;
    const z = Math.cos(a) * CORE_RING;
    out.set(id, { x, z, ry: Math.atan2(-x, -z) });
  });

  for (const d of DISTRICTS) {
    const ids = (byZone.get(d.zone) ?? []).sort();
    if (ids.length === 0) continue;
    const cols = Math.ceil(Math.sqrt(ids.length));
    const rows = Math.ceil(ids.length / cols);
    // Fronts face the Core so arriving players see the signs.
    const facing = Math.atan2(-d.x, -d.z);
    ids.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const lx = (col - (cols - 1) / 2) * LOT_SPACING;
      const lz = (row - (rows - 1) / 2) * LOT_SPACING;
      out.set(id, { x: d.x + lx, z: d.z + lz, ry: facing });
    });
  }
  return out;
}

/** Road headings out of the Core, one per district. */
export const ROAD_ANGLES = DISTRICTS.map((d) => Math.atan2(d.x, d.z));

function slotAngle(i: number, n: number): number {
  // Spread n slots over the ring minus three 22-degree road gaps.
  const gap = (22 * Math.PI) / 180;
  const usable = Math.PI * 2 - gap * ROAD_ANGLES.length;
  const perArc = Math.ceil(n / ROAD_ANGLES.length);
  const arc = Math.floor(i / perArc);
  const k = i % perArc;
  const arcLen = usable / ROAD_ANGLES.length;
  const start = ROAD_ANGLES[arc % ROAD_ANGLES.length] + gap / 2;
  return start + ((k + 0.5) / perArc) * arcLen;
}

/* --------------------------------- cover --------------------------------- */

/**
 * A vertical cylinder that blocks walking and bullets: [x, z, radius, height].
 * Height left out = infinitely tall (walking-only obstacles).
 */
export type Cover = [number, number, number, number?];

/** Roughly how tall each kind of building is, for stopping bullets. */
const COVER_HEIGHT: Record<string, number> = {
  tower: 24,
  beacon: 15,
  observatory: 12,
  mining_claim: 11,
  dock: 11,
  foundry: 11,
  hangar: 8,
  yard: 5,
  quarry: 4,
  array: 2.5,
  field: 1.5,
};
export const DEFAULT_COVER_HEIGHT = 7;

/** The cover a property's building gives: the same circle the client walks around. */
export function buildingCover(place: Placement, type: string): Cover {
  return [place.x - Math.sin(place.ry) * 1.5, place.z - Math.cos(place.ry) * 1.5, BUILDING_RADIUS - 1.5, COVER_HEIGHT[type] ?? DEFAULT_COVER_HEIGHT];
}

/** Every building's cover, laid out exactly as the client lays out the world. */
export function buildingCovers(props: { id: string; zone: string; type: string }[]): Cover[] {
  const places = layoutProperties(props);
  const out: Cover[] = [];
  for (const p of props) {
    const at = places.get(p.id);
    if (at) out.push(buildingCover(at, p.type));
  }
  return out;
}

/**
 * How far a shot from `o` along unit direction `d` travels before hitting
 * cover - or `maxT` if nothing is in the way. Cylinder walls only: a shot
 * passing over a building's top flies on. Cover the shot starts inside is
 * ignored, so standing against a wall never blocks your own shots.
 */
export function shotBlockedAt(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, covers: readonly Cover[], maxT: number): number {
  let best = maxT;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return best;
  for (const [cx, cz, r, h = Infinity] of covers) {
    const ox = o.x - cx;
    const oz = o.z - cz;
    const c = ox * ox + oz * oz - r * r;
    if (c <= 0) continue;
    const b = 2 * (ox * d.x + oz * d.z);
    if (b >= 0) continue; // moving away from it
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t >= best) continue;
    const y = o.y + d.y * t;
    if (y >= 0 && y <= h) best = t;
  }
  return best;
}
