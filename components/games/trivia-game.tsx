"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameContext } from "@/components/games/game-shell";

interface Q {
  id: string;
  q: string;
  choices: string[];
}

const PER_Q_SECONDS = 15;

export function TriviaGame({ start, complete }: GameContext) {
  const questions = useMemo<Q[]>(
    () => (start?.questions as Q[] | undefined) ?? [],
    [start],
  );
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(PER_Q_SECONDS);

  const q = questions[idx];

  useEffect(() => {
    // Intentional per-question countdown reset when idx changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(PER_Q_SECONDS);
    const t = setInterval(() => {
      setTimeLeft((v) => {
        if (v <= 1) {
          clearInterval(t);
          lockIn(-1);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function lockIn(choice: number) {
    if (picked !== null) return;
    setPicked(choice);
    const next = [...answers, choice];
    setAnswers(next);
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        complete({ answers: next });
      } else {
        setPicked(null);
        setIdx(idx + 1);
      }
    }, 550);
  }

  if (!q) return <p className="text-muted">No questions available.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {idx + 1} / {questions.length}
        </span>
        <span
          className={`mono ${timeLeft <= 5 ? "text-bad" : ""}`}
        >
          {timeLeft}s
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${(timeLeft / PER_Q_SECONDS) * 100}%` }}
        />
      </div>

      <h2 className="text-lg font-bold">{q.q}</h2>

      <div className="grid gap-2">
        {q.choices.map((c, i) => {
          const isPicked = picked === i;
          return (
            <button
              key={i}
              disabled={picked !== null}
              onClick={() => lockIn(i)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                isPicked
                  ? "border-accent bg-accent/15"
                  : "border-border bg-surface-2 hover:border-accent/50"
              } disabled:cursor-default`}
            >
              <span className="mono mr-2 text-muted">
                {String.fromCharCode(65 + i)}
              </span>
              {c}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Answers lock in immediately. XP scales with correct answers.
      </p>
    </div>
  );
}
