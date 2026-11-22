/**
 * The buildings that stop bullets, for the server's hit checks.
 *
 * Built from the property market (id, zone, type) with the same shared layout
 * the client draws, so the server's walls are exactly where players see them.
 * Properties are public data: read through Supabase's REST API with the
 * public anon key (the same key the website ships to every browser).
 *
 * Until the first load succeeds - or with no SUPABASE_URL configured, as in
 * tests - there is no cover and shots behave as before.
 */
import { buildingCovers, layoutProperties, type Cover } from "@chimp-arena/shared";

const REFRESH_MS = 10 * 60 * 1000;
const RETRY_MS = 30 * 1000;

let covers: readonly Cover[] = [];
/** Dock lots (ships you can board), from the same layout. */
let docks: readonly { id: string; x: number; z: number }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

export function worldCovers(): readonly Cover[] {
  return covers;
}

export function worldDocks(): readonly { id: string; x: number; z: number }[] {
  return docks;
}

/** For tests: use these docks instead of loading them. */
export function setWorldDocks(next: readonly { id: string; x: number; z: number }[]): void {
  docks = next;
}

/** For tests: use these covers instead of loading them. */
export function setWorldCovers(next: readonly Cover[]): void {
  covers = next;
}

async function load(url: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/rest/v1/properties?select=id,zone,type&order=id`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as { id: string; zone: string; type: string }[];
    covers = buildingCovers(rows);
    const places = layoutProperties(rows);
    docks = rows.filter((r) => r.type === "dock").flatMap((r) => {
      const at = places.get(r.id);
      return at ? [{ id: r.id, x: at.x, z: at.z }] : [];
    });
    console.log(`[world] ${covers.length} buildings now stop bullets`);
    return true;
  } catch (e) {
    console.warn(`[world] couldn't load the property layout (${(e as Error).message}); retrying`);
    return false;
  }
}

/** Load now, then keep up to date (new properties, type changes). */
export function startWorldCovers(): void {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("[world] SUPABASE_URL / SUPABASE_ANON_KEY not set: bullets pass through buildings");
    return;
  }
  const tick = async () => {
    const ok = await load(url, key);
    timer = setTimeout(tick, ok ? REFRESH_MS : RETRY_MS);
    timer.unref?.();
  };
  void tick();
}

export function stopWorldCovers(): void {
  if (timer) clearTimeout(timer);
}
