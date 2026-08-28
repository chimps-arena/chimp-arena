"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameContext } from "@/components/games/game-shell";

const ROUNDS = 5;

type State =
  | { kind: "ready" }
  | { kind: "waiting" } // green pending, don't click
  | { kind: "go"; shownAt: number }
  | { kind: "tooSoon" }
  | { kind: "hit"; ms: number };

export function ReactionGame({ complete }: GameContext) {
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [state, setState] = useState<State>({ kind: "ready" });
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    setState({ kind: "waiting" });
    const delay = 900 + Math.random() * 2600;
    timeout.current = setTimeout(() => {
      setState({ kind: "go", shownAt: performance.now() });
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (state.kind === "ready") {
      arm();
      return;
    }
    if (state.kind === "waiting") {
      if (timeout.current) clearTimeout(timeout.current);
      setState({ kind: "tooSoon" });
      return;
    }
    if (state.kind === "go") {
      const ms = Math.round(performance.now() - state.shownAt);
      const nextTimes = [...times, ms];
      const nextRound = round + 1;
      setTimes(nextTimes);
      setRound(nextRound);
      setState({ kind: "hit", ms });
      if (nextRound >= ROUNDS) {
        setTimeout(() => complete({ rounds: nextTimes }), 650);
      }
      return;
    }
    if (state.kind === "tooSoon" || state.kind === "hit") {
      arm();
    }
  }, [state, arm, times, round, complete]);

  const bg =
    state.kind === "go"
      ? "bg-good/90 text-black"
      : state.kind === "waiting"
        ? "bg-bad/80"
        : state.kind === "tooSoon"
          ? "bg-bad/60"
          : "bg-surface-2";

  const label =
    state.kind === "ready"
      ? "Click to begin"
      : state.kind === "waiting"
        ? "Wait for green…"
        : state.kind === "go"
          ? "CLICK!"
          : state.kind === "tooSoon"
            ? "Too soon! Click to retry the round"
            : `${state.ms} ms — click for next`;

  const avg = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between text-sm text-muted">
        <span>
          Round {Math.min(round + (state.kind === "hit" ? 0 : 1), ROUNDS)} / {ROUNDS}
        </span>
        <span className="mono">avg {avg} ms</span>
      </div>
      <button
        onClick={handleClick}
        className={`flex h-64 w-full select-none items-center justify-center rounded-2xl text-xl font-black transition-colors ${bg}`}
      >
        {label}
      </button>
      <div className="mono flex gap-2 text-xs text-muted">
        {Array.from({ length: ROUNDS }).map((_, i) => (
          <span
            key={i}
            className="flex-1 rounded bg-surface-2 py-1 text-center"
          >
            {times[i] != null ? `${times[i]}ms` : "—"}
          </span>
        ))}
      </div>
    </div>
  );
}
