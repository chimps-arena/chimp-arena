"use client";

/**
 * The story in the game: an opening briefing the first time you play, then
 * Chapter 1 ("Arrival") as a mission tracker that ticks off as you do
 * things in the world. Progress is kept in this browser (localStorage).
 * The full story draft lives in docs/astroworld-story.md.
 */

import { useEffect, useState } from "react";
import { npcTalkStore } from "./npcs";

const KEY = "astroworld:story:v1";

interface Step {
  id: string;
  title: string;
  hint: string;
  /** Does using this interactable (npc/kiosk/property/port key) complete the step? */
  done: (key: string) => boolean;
}

const CHAPTER_1: Step[] = [
  { id: "castro", title: "Report to Astromilitary", hint: "Castro patrols the Core plaza. Walk up and press E.", done: (k) => k === "military" },
  { id: "news", title: "Read the news", hint: "Any Astro-News stand (📰 on the map).", done: (k) => k.startsWith("news-") },
  { id: "burger", title: "Eat at Astroburger", hint: "South of Astrocorp HQ. Talk to Drink Mixer or use the door.", done: (k) => k === "astroburger-staff" || k === "landmark-astroburger" },
  { id: "property", title: "Visit a property", hint: "Press E at the front of any lot.", done: (k) => k.startsWith("prop:") },
  { id: "fly", title: "Fly out to a district", hint: "Board the ship at a starport (🚀 on the map) or a docked ship.", done: (k) => k === "arrived" },
  { id: "death", title: "Find the bounty hunter", hint: "Death stalks the open ground outside the Core wall.", done: (k) => k === "bounty" },
];

interface Progress {
  intro: boolean;
  done: string[];
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    /* private mode */
  }
  return { intro: false, done: [] };
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

const INTRO: { title: string; text: string }[] = [
  {
    title: "Year 2175",
    text: "Astroworld is the richest rock in the sector. Its crust is threaded with Void Crystal: the power behind every ship, weapon and city in the galaxy.",
  },
  {
    title: "Astrocorp built it",
    text: "Their tower stands in the Core, a walled city where nobody draws a weapon. A brighter tomorrow, they say. Outside the wall, the rules stop.",
  },
  {
    title: "Everyone is coming",
    text: "Kill Boy Tommy vanished from Sector 7 with something Astrocorp wants back. 500,000 $CHIMP on his head. Hunters, rebels and the Imperial Dynasty are all on their way.",
  },
  {
    title: "You just landed",
    text: "Find your feet in the Core, then head out to the districts. Everyone here wants something from you.",
  },
];

/** Progress after using `k` (unchanged object if nothing new was completed). */
function completeFor(prev: Progress, k: string): Progress {
  const add = CHAPTER_1.filter((s) => !prev.done.includes(s.id) && s.done(k)).map((s) => s.id);
  if (add.length === 0) return prev;
  const next = { ...prev, done: [...prev.done, ...add] };
  save(next);
  return next;
}

/** Opening briefing (first visit) + Chapter 1 tracker. */
export function Story({ onArrive }: { onArrive: (cb: () => void) => () => void }) {
  // Client-only component (the whole scene loads with ssr: false), so browser storage is safe here.
  const [p, setP] = useState<Progress>(load);
  const [slide, setSlide] = useState(0);
  const [open, setOpen] = useState(true);

  // Tick off steps from what the player uses, and from arriving by ship.
  useEffect(
    () =>
      npcTalkStore.subscribe(() => {
        const k = npcTalkStore.get().talking;
        if (k) setP((prev) => completeFor(prev, k));
      }),
    [],
  );
  useEffect(() => onArrive(() => setP((prev) => completeFor(prev, "arrived"))), [onArrive]);

  if (!p.intro) {
    const s = INTRO[slide];
    const last = slide === INTRO.length - 1;
    const finish = () => {
      const next = { ...p, intro: true };
      save(next);
      setP(next);
    };
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur">
        <div className="w-full max-w-lg text-center text-white">
          <div className="text-[11px] uppercase tracking-[0.4em] text-fuchsia-300">Astroworld · Chapter 1 · Arrival</div>
          <div className="mt-4 text-3xl font-black">{s.title}</div>
          <p className="mt-3 text-base leading-relaxed text-white/80">{s.text}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button type="button" onClick={finish} className="rounded px-3 py-1.5 text-sm text-white/50 hover:text-white">
              Skip
            </button>
            <button
              type="button"
              onClick={() => (last ? finish() : setSlide(slide + 1))}
              className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-black hover:bg-amber-300"
            >
              {last ? "Start" : "Next"}
            </button>
          </div>
          <div className="mt-4 flex justify-center gap-1.5">
            {INTRO.map((_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i === slide ? "bg-amber-400" : "bg-white/20"}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const doneCount = CHAPTER_1.filter((s) => p.done.includes(s.id)).length;
  const finished = doneCount === CHAPTER_1.length;
  const nextStep = CHAPTER_1.find((s) => !p.done.includes(s.id));
  return (
    <div className="pointer-events-auto absolute right-3 top-28 z-20 w-64 rounded-lg border border-fuchsia-400/40 bg-black/70 text-white backdrop-blur-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span>
          <span className="block text-[10px] uppercase tracking-wider text-fuchsia-300">Chapter 1 · Arrival</span>
          <span className="text-xs font-bold">{finished ? "Chapter complete" : nextStep?.title}</span>
        </span>
        <span className="text-[11px] text-white/60">
          {doneCount}/{CHAPTER_1.length} {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="border-t border-white/10 px-3 py-2">
          {finished ? (
            <p className="text-xs leading-relaxed text-white/80">
              Death told you what the hunters know: Tommy&apos;s trail starts at the Belt claims. <b className="text-fuchsia-300">Chapter 2: The Sector 7 Manhunt</b> is coming soon.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {CHAPTER_1.map((s) => {
                const done = p.done.includes(s.id);
                return (
                  <li key={s.id} className="text-xs">
                    <span className={done ? "text-emerald-400" : "text-white/40"}>{done ? "✓" : "○"}</span>{" "}
                    <span className={done ? "text-white/50 line-through" : "font-semibold"}>{s.title}</span>
                    {!done && s.id === nextStep?.id && <div className="ml-4 text-[11px] text-white/60">{s.hint}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
