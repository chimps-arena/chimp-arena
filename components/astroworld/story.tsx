"use client";

/**
 * The story in the game: an opening briefing the first time you play, then
 * the chapter tracker (Chapter 1 "Arrival", Chapter 2 "The Sector 7
 * Manhunt") with faction reputation once you've chosen who gets Tommy's map.
 * State lives in story-state.ts; the full story is docs/astroworld-story.md.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { npcTalkStore } from "./npcs";
import { CHAPTER_1, CHAPTER_2, CHAPTER_3, chapter1Done, chapter2Done, completeStep, FACTIONS, finishIntro, isDone, storyStore, type Faction, type StoryState } from "./story-state";

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

const ENDINGS: Record<Faction, string> = {
  astrocorp: "You handed Tommy's map to Astrocorp. The seam goes on the books, Castro owes you, and the hunters and rebels won't forget it.",
  hunters: "You sold Tommy's map to the hunters. Death paid well, and Astrocorp and the rebels both have your name now.",
  rebels: "You kept Tommy's map with the rebels. The crystal stays with the people who dig it, and Astrocorp and the hunters want to know where it went.",
};

function Reputation({ s }: { s: StoryState }) {
  return (
    <div className="mt-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-white/50">Reputation</div>
      {(Object.keys(FACTIONS) as Faction[]).map((f) => {
        const v = s.rep[f];
        return (
          <div key={f} className="flex items-center gap-2 text-[11px]">
            <span className="w-20 shrink-0" style={{ color: FACTIONS[f].color }}>
              {FACTIONS[f].name}
            </span>
            <span className="relative h-1.5 flex-1 rounded bg-white/10">
              <span className="absolute top-0 h-1.5 w-px bg-white/40" style={{ left: "50%" }} />
              <span
                className="absolute top-0 h-1.5 rounded"
                style={{ background: FACTIONS[f].color, left: v >= 0 ? "50%" : `${50 + v / 2}%`, width: `${Math.abs(v) / 2}%` }}
              />
            </span>
            <span className="w-7 text-right tabular-nums text-white/70">{v > 0 ? `+${v}` : v}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Opening briefing (first visit) + chapter tracker. */
export function Story({ onArrive }: { onArrive: (cb: () => void) => () => void }) {
  const s = useSyncExternalStore(storyStore.subscribe, storyStore.get, storyStore.get);
  const [slide, setSlide] = useState(0);
  // Collapsed by default on phones (it covers too much of the view).
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);

  // Chapter 1 steps tick off from what the player uses, and from arriving by ship.
  useEffect(
    () =>
      npcTalkStore.subscribe(() => {
        const k = npcTalkStore.get().talking;
        if (!k) return;
        for (const st of CHAPTER_1) if (st.byUse?.(k)) completeStep(st.id);
      }),
    [],
  );
  useEffect(() => onArrive(() => completeStep("fly")), [onArrive]);

  if (!s.intro) {
    const card = INTRO[slide];
    const last = slide === INTRO.length - 1;
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur">
        <div className="w-full max-w-lg text-center text-white">
          <div className="text-[11px] uppercase tracking-[0.4em] text-fuchsia-300">Astroworld · Chapter 1 · Arrival</div>
          <div className="mt-4 text-3xl font-black">{card.title}</div>
          <p className="mt-3 text-base leading-relaxed text-white/80">{card.text}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button type="button" onClick={finishIntro} className="rounded px-3 py-1.5 text-sm text-white/50 hover:text-white">
              Skip
            </button>
            <button
              type="button"
              onClick={() => (last ? finishIntro() : setSlide(slide + 1))}
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

  const inCh3 = chapter2Done(s);
  const inCh2 = chapter1Done(s) && !inCh3;
  const steps = inCh3 ? CHAPTER_3 : inCh2 ? CHAPTER_2 : CHAPTER_1;
  const title = inCh3 ? "Chapter 3 · The Games" : inCh2 ? "Chapter 2 · The Sector 7 Manhunt" : "Chapter 1 · Arrival";
  const doneCount = steps.filter((st) => isDone(s, st.id)).length;
  const finished = doneCount === steps.length;
  const nextStep = steps.find((st) => !isDone(s, st.id));
  return (
    <div className="pointer-events-auto absolute right-2 top-14 z-20 w-[48vw] rounded-lg sm:right-3 sm:top-28 sm:w-72 border border-fuchsia-400/40 bg-black/70 text-white backdrop-blur-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-wider text-fuchsia-300">{title}</span>
          <span className="block truncate text-xs font-bold">{finished ? "Chapter complete" : nextStep?.title}</span>
        </span>
        <span className="shrink-0 text-[11px] text-white/60">
          {doneCount}/{steps.length} {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="border-t border-white/10 px-3 py-2">
          {finished && inCh3 ? (
            <>
              <p className="text-xs leading-relaxed text-white/80">
                Champion of the Arena. Keep running trials and winning fights here to raise your sponsor&apos;s favour. Best: {s.trialBest} drones.
              </p>
              <p className="mt-1.5 text-[11px] text-white/50">
                <b className="text-fuchsia-300">Chapter 4: The Grand Prix</b> is coming.
              </p>
            </>
          ) : (
            <>
              {inCh3 && s.mapTo && doneCount === 0 && <p className="mb-2 text-xs leading-relaxed text-white/70">{ENDINGS[s.mapTo]}</p>}
              <ul className="space-y-1.5">
                {steps.map((st) => {
                  const done = isDone(s, st.id);
                  return (
                    <li key={st.id} className="text-xs">
                      <span className={done ? "text-emerald-400" : "text-white/40"}>{done ? "✓" : "○"}</span>{" "}
                      <span className={done ? "text-white/50 line-through" : "font-semibold"}>{st.title}</span>
                      {!done && st.id === nextStep?.id && <div className="ml-4 text-[11px] text-white/60">{st.hint}</div>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {inCh2 && !s.mapTo && doneCount === 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-white/60">Death says Tommy came through the Belt claims. Start there.</p>
          )}
          {s.mapTo && <Reputation s={s} />}
        </div>
      )}
    </div>
  );
}
