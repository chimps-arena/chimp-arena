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
  /** Chapter 3: the faction sponsoring you in the Arena. */
  sponsor: Faction | null;
  /** Best Arena trial score (drones in 60 s). */
  trialBest: number;
}

const KEY = "astroworld:story:v1";
const FRESH: StoryState = { intro: false, done: [], rep: { astrocorp: 0, hunters: 0, rebels: 0 }, mapTo: null, sponsor: null, trialBest: 0 };

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
export const chapter2Done = (s: StoryState) => isDone(s, "ch2-choice");

// Chapter 3 steps come from Caesar's dialogue and the Arena trials.
export const CHAPTER_3: Step[] = [
  { id: "ch3-caesar", title: "Answer Caesar's summons", hint: "Caesar waits at the Arena gate. Fly to The Arena from any starport." },
  { id: "ch3-sponsor", title: "Choose a sponsor", hint: "Ask Caesar: Astrocorp, the hunters or the rebels will back you." },
  { id: "ch3-trial", title: "Pass a trial: 15 drones", hint: "Press E at the trial gate in the middle of the Arena. 60 seconds." },
  { id: "ch3-champion", title: "Become a champion: 25 drones", hint: "Beat 25 in one trial. Every trial earns your sponsor's favour." },
];

/** Thresholds for the trial steps. */
export const TRIAL_PASS = 15;
export const TRIAL_CHAMPION = 25;

/** Chapter 3: a faction backs you in the Arena (+10 with them). Can be changed later at Caesar. */
export function setSponsor(f: Faction) {
  const s = storyStore.get();
  if (s.sponsor === f) return;
  const first = !s.sponsor;
  set({ ...s, sponsor: f, rep: { ...s.rep, [f]: clamp(s.rep[f] + (first ? 10 : 0)) } });
  completeStep("ch3-sponsor");
}

/**
 * A finished trial: +3 with your sponsor (+2 more for a new best), and the
 * chapter steps it earns. This is how players win factions back over time.
 */
export function recordTrial(score: number) {
  const s = storyStore.get();
  const best = Math.max(s.trialBest, score);
  const rep = { ...s.rep };
  if (s.sponsor) rep[s.sponsor] = clamp(rep[s.sponsor] + 3 + (score > s.trialBest ? 2 : 0));
  set({ ...s, rep, trialBest: best });
  if (score >= TRIAL_PASS) completeStep("ch3-trial");
  if (score >= TRIAL_CHAMPION) completeStep("ch3-champion");
}

/** Tommy's hideout: out in the open ground between the Belt and the Rim. */
export const HIDEOUT = { x: Math.sin(Math.PI / 3) * 470, z: Math.cos(Math.PI / 3) * 470 };
