"use client";

/**
 * Objective marker: a diamond on screen over the place your current story
 * step happens (an NPC, a newsstand, Astroburger, a starport, the hideout),
 * with the distance. When the place is behind you or off screen it sticks to
 * the screen edge and points the way.
 *
 * ObjectiveTracker runs inside the 3D canvas and moves the DOM marker that
 * ObjectiveMarker renders in the HUD each frame (no React re-renders).
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STARPORTS } from "@chimp-arena/shared";
import { nearestWithPrefix, npcPosition } from "./npcs";
import { ASTROBURGER } from "./astroburger";
import { CHAPTER_1, CHAPTER_2, CHAPTER_3, chapter1Done, chapter2Done, HIDEOUT, isDone, storyStore } from "./story-state";
import { TRIAL_GATE } from "./arena";

type Pos = { x: number; z: number };

/** Where each story step happens, given where you are now. */
function targetFor(step: string, me: Pos): Pos | null {
  switch (step) {
    case "castro":
      return npcPosition("military");
    case "news":
      return nearestWithPrefix("news-", me.x, me.z);
    case "burger":
      return { x: ASTROBURGER.x, z: ASTROBURGER.z + 8 };
    case "property":
      return nearestWithPrefix("prop:", me.x, me.z);
    case "fly": {
      let best: Pos | null = null;
      let bd = Infinity;
      for (const s of STARPORTS) {
        const d = Math.hypot(s.x - me.x, s.z - me.z);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    }
    case "death":
      return npcPosition("bounty");
    case "ch2-belt":
      return npcPosition("story-belt");
    case "ch2-rim":
      return npcPosition("story-rim");
    case "ch2-docks":
      return npcPosition("story-docks");
    case "ch2-tommy":
    case "ch2-choice":
      return npcPosition("story-tommy") ?? HIDEOUT;
    case "ch3-caesar":
    case "ch3-sponsor":
      return npcPosition("story-caesar");
    case "ch3-trial":
    case "ch3-champion":
      return TRIAL_GATE;
    default:
      return null;
  }
}

function currentStep(): string | null {
  const s = storyStore.get();
  if (!s.intro) return null;
  const steps = chapter2Done(s) ? CHAPTER_3 : chapter1Done(s) ? CHAPTER_2 : CHAPTER_1;
  return steps.find((st) => !isDone(s, st.id))?.id ?? null;
}

let markerEl: HTMLDivElement | null = null;

/** HUD side: the marker element (positioned by ObjectiveTracker). */
export function ObjectiveMarker() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    markerEl = ref.current;
    return () => {
      markerEl = null;
    };
  }, []);
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-10" style={{ display: "none" }}>
      <div data-arrow className="absolute -left-3 -top-3 h-6 w-6">
        <div className="h-6 w-6 rotate-45 rounded-sm border-2 border-fuchsia-300 bg-fuchsia-500/40 shadow-[0_0_12px_rgba(232,121,249,0.9)]" />
      </div>
      <div data-dist className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 text-[11px] font-bold text-fuchsia-200" />
    </div>
  );
}

const v = new THREE.Vector3();
const EDGE = 36;

function placeMarker(camera: THREE.Camera, size: { width: number; height: number }, me: Pos | null) {
  const el = markerEl;
  if (!el) return;
  const step = currentStep();
  const target = step && me ? targetFor(step, me) : null;
  if (!target || !me) {
    if (el.style.display !== "none") el.style.display = "none";
    return;
  }
  const dist = Math.hypot(target.x - me.x, target.z - me.z);
  // Hide it once you're there (the "Press E" prompt takes over).
  if (dist < 5) {
    if (el.style.display !== "none") el.style.display = "none";
    return;
  }
  v.set(target.x, 2.6, target.z).project(camera);
  const behind = v.z > 1;
  let sx = (v.x * 0.5 + 0.5) * size.width;
  let sy = (-v.y * 0.5 + 0.5) * size.height;
  if (behind) {
    // Mirror so it points the right way round when the target is behind you.
    sx = size.width - sx;
    sy = size.height - EDGE;
  }
  const off = behind || sx < EDGE || sx > size.width - EDGE || sy < EDGE || sy > size.height - EDGE;
  sx = Math.min(size.width - EDGE, Math.max(EDGE, sx));
  sy = Math.min(size.height - EDGE, Math.max(EDGE, sy));
  el.style.display = "block";
  el.style.transform = `translate(${sx}px, ${sy}px)`;
  el.style.opacity = off ? "0.85" : "1";
  const label = el.querySelector<HTMLDivElement>("[data-dist]");
  if (label) {
    const text = `${Math.round(dist)} m`;
    if (label.textContent !== text) label.textContent = text;
  }
}

/** Canvas side: projects the current objective onto the screen every frame. */
export function ObjectiveTracker({ getMe }: { getMe: () => Pos | null }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useFrame(() => placeMarker(camera, size, getMe()));
  return null;
}
