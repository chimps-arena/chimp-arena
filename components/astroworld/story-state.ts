/**
 * Story progress for this player: chapter steps done, faction reputation,
 * and the Chapter 2 choice. A small store (get/subscribe) so the tracker,
 * NPC dialogue and the NPC list all react to it. Kept in this browser
 * (localStorage) until players have accounts in the game.
 */

import { sfx } from "./audio";

export type Faction = "astrocorp" | "hunters" | "rebels";

export const FACTIONS: Record<Faction, { name: string; color: string }> = {
  astrocorp: { name: "Astrocorp", color: "#a855f7" },
  hunters: { name: "The hunters", color: "#ef4444" },
  rebels: { name: "The rebels", color: "#f59e0b" },
};

export interface StoryState {
  intro: boolean;
  done: string[];
  /** -100 (hated) .. 100 (trusted). Rises and falls; nothing is permanent. */
  rep: Record<Faction, number>;
  /** Who got Tommy's map in Chapter 2. */
  mapTo: Faction | null;
}

const KEY = "astroworld:story:v1";
const FRESH: StoryState = { intro: false, done: [], rep: { astrocorp: 0, hunters: 0, rebels: 0 }, mapTo: null };

function load(): StoryState {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) return { ...FRESH, ...(JSON.parse(raw) as Partial<StoryState>), rep: { ...FRESH.rep, ...(JSON.parse(raw) as Partial<StoryState>).rep } };
  } catch {
    /* private mode or bad data */
  }
  return FRESH;
}

let state: StoryState | null = null;
const subs = new Set<() => void>();

function set(next: StoryState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  subs.forEach((cb) => cb());
}

export const storyStore = {
  get: (): StoryState => (state ??= load()),
  subscribe: (cb: () => void) => {
    subs.add(cb);
    return () => void subs.delete(cb);
  },
};

export const isDone = (s: StoryState, step: string) => s.done.includes(step);

export function finishIntro() {
  set({ ...storyStore.get(), intro: true });
}

export function completeStep(step: string) {
  const s = storyStore.get();
  if (s.done.includes(step)) return;
  set({ ...s, done: [...s.done, step] });
  sfx.objective();
}

/** Chapter 2 finale: the map goes to one faction. Big boost for them, a drop for the others. */
export function giveMapTo(f: Faction) {
  const s = storyStore.get();
  if (s.mapTo) return;
  const rep = { ...s.rep };
  for (const k of Object.keys(rep) as Faction[]) rep[k] = clamp(rep[k] + (k === f ? 40 : -20));
  set({ ...s, rep, mapTo: f, done: s.done.includes("ch2-choice") ? s.done : [...s.done, "ch2-choice"] });
  sfx.objective();
}

/** Small reputation changes from later missions (how players win factions back). */
export function adjustRep(f: Faction, by: number) {
  const s = storyStore.get();
  set({ ...s, rep: { ...s.rep, [f]: clamp(s.rep[f] + by) } });
}

const clamp = (n: number) => Math.max(-100, Math.min(100, n));

/* --------------------------------- chapters --------------------------------- */

export interface Step {
  id: string;
  title: string;
  hint: string;
  /** Completed by using this interactable key (NPC, stand, property, port), or "arrived". */
  byUse?: (key: string) => boolean;
}

export const CHAPTER_1: Step[] = [
  { id: "castro", title: "Report to Astromilitary", hint: "Castro patrols the Core plaza. Walk up and press E.", byUse: (k) => k === "military" },
  { id: "news", title: "Read the news", hint: "Any Astro-News stand (📰 on the map).", byUse: (k) => k.startsWith("news-") },
  { id: "burger", title: "Eat at Astroburger", hint: "South of Astrocorp HQ. Talk to Drink Mixer or use the door.", byUse: (k) => k === "astroburger-staff" || k === "landmark-astroburger" },
  { id: "property", title: "Visit a property", hint: "Press E at the front of any lot.", byUse: (k) => k.startsWith("prop:") },
  { id: "fly", title: "Fly out to a district", hint: "Board the ship at a starport (🚀 on the map) or a docked ship.", byUse: (k) => k === "arrived" },
  { id: "death", title: "Find the bounty hunter", hint: "Death stalks the open ground outside the Core wall.", byUse: (k) => k === "bounty" },
];

// Chapter 2 steps are completed from dialogue (asking the right question).
export const CHAPTER_2: Step[] = [
  { id: "ch2-belt", title: "Ask the Belt claim crews", hint: "Bad Mike works a claim in The Belt. Fly there from a starport." },
  { id: "ch2-rim", title: "Find the watcher on the Rim", hint: "Senex keeps watch by a dome in Lunar Rim." },
  { id: "ch2-docks", title: "Meet the smuggler at the Docks", hint: "Lady Winter waits by a dock in Helios Docks." },
  { id: "ch2-tommy", title: "Find Kill Boy Tommy", hint: "His hideout is out between the Belt and the Rim. It's marked on the map (M)." },
  { id: "ch2-choice", title: "Decide who gets the map", hint: "Astrocorp, the hunters or the rebels. Talk to Tommy." },
];

export const chapter1Done = (s: StoryState) => CHAPTER_1.every((st) => isDone(s, st.id));

/** Tommy's hideout: out in the open ground between the Belt and the Rim. */
export const HIDEOUT = { x: Math.sin(Math.PI / 3) * 470, z: Math.cos(Math.PI / 3) * 470 };
