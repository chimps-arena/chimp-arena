/**
 * Which animation clip in an artist's .glb plays which move.
 *
 * Artists (and Mixamo) name clips all sorts of ways - "Idle", "Rifle Aiming
 * Idle", "mixamo.com|Walking" - so clips are matched by keyword, not exact
 * name. Used by the game (to pick the clip) and by scripts/check-models.mjs
 * (to tell the artist what's missing), so both always agree.
 *
 * Self-contained on purpose (no imports): the check script loads this file
 * directly with Node's built-in TypeScript support.
 */

export type ClipRole = "idle" | "walk" | "run" | "crouch" | "jump" | "rifleIdle" | "rifleWalk" | "fire" | "death" | "drive";

/** Checked in order: the first matching rule wins, so specific ones come first. */
const RULES: [ClipRole, RegExp][] = [
  ["death", /death|dying|die\b/i],
  ["drive", /driv|sitting|seated/i],
  ["fire", /fire|shoot/i],
  ["rifleWalk", /(rifle|aim|gun).*(walk|run|strafe)|(walk|run|strafe).*(rifle|aim|gun)/i],
  ["rifleIdle", /rifle|aim|gun/i],
  ["crouch", /crouch/i],
  ["jump", /jump/i],
  ["run", /run|sprint/i],
  ["walk", /walk/i],
  ["idle", /idle|breath|stand/i],
];

export function clipRole(name: string): ClipRole | null {
  for (const [role, re] of RULES) if (re.test(name)) return role;
  return null;
}

/** A model must have these to be usable at all. */
export const REQUIRED_ROLES: ClipRole[] = ["idle", "walk"];
/** Nice to have - the game falls back to the nearest move without them. */
export const OPTIONAL_ROLES: ClipRole[] = ["run", "crouch", "jump", "rifleIdle", "rifleWalk", "death", "drive"];

/** When a role's clip is missing, play this one instead. */
export const FALLBACK: Record<ClipRole, ClipRole | null> = {
  idle: null,
  walk: "idle",
  run: "walk",
  crouch: "walk",
  jump: "idle",
  rifleIdle: "idle",
  rifleWalk: "walk",
  fire: "rifleIdle",
  death: "idle",
  drive: "idle",
};

/** Map a model's clip names to roles (first clip found per role wins). */
export function mapClips(names: string[]): Partial<Record<ClipRole, string>> {
  const out: Partial<Record<ClipRole, string>> = {};
  for (const n of names) {
    const role = clipRole(n);
    if (role && !out[role]) out[role] = n;
  }
  return out;
}

/** Follow the fallback chain until a role the model actually has. */
export function resolveRole(role: ClipRole, have: Partial<Record<ClipRole, string>>): string | null {
  let r: ClipRole | null = role;
  while (r) {
    if (have[r]) return have[r]!;
    r = FALLBACK[r];
  }
  return null;
}
