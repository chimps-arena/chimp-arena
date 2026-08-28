"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { useSession } from "@/components/session-provider";
import type { SubmitResult } from "@/lib/types";

type Phase = "intro" | "loading" | "playing" | "submitting" | "result" | "error";

export interface GameContext {
  /** raw start-endpoint response (contains startToken and, for trivia, questions) */
  start: Record<string, unknown> | null;
  /** call when the mini-game produces a result payload */
  complete: (payload: Record<string, unknown>) => void;
}

export function GameShell({
  slug,
  title,
  subtitle,
  instructions,
  renderGame,
}: {
  slug: string;
  title: string;
  subtitle: string;
  instructions: ReactNode;
  renderGame: (ctx: GameContext) => ReactNode;
}) {
  const { refresh } = useSession();
  const [phase, setPhase] = useState<Phase>("intro");
  const [start, setStart] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const begin = useCallback(async () => {
    setError(null);
    setPhase("loading");
    try {
      const res = await fetch(`/api/missions/${slug}/start`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not start mission");
      }
      setStart(await res.json());
      setPhase("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
      setPhase("error");
    }
  }, [slug]);

  const complete = useCallback(
    async (payload: Record<string, unknown>) => {
      const startToken = start?.startToken as string | undefined;
      if (!startToken) {
        setError("Missing start token — restart the mission.");
        setPhase("error");
        return;
      }
      setPhase("submitting");
      try {
        const res = await fetch(`/api/missions/${slug}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ startToken, ...payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Submission rejected");
        setResult(data as SubmitResult);
        setPhase("result");
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submission failed");
        setPhase("error");
      }
    },
    [slug, start, refresh],
  );

  const replay = useCallback(() => {
    setResult(null);
    setStart(null);
    setPhase("intro");
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Mission Control
        </Link>
        <h1 className="mt-2 text-2xl font-black">{title}</h1>
        <p className="text-muted">{subtitle}</p>
      </div>

      <div className="card p-6">
        {phase === "intro" && (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-muted">{instructions}</div>
            <button className="btn btn-primary w-fit" onClick={begin}>
              Start mission
            </button>
          </div>
        )}

        {phase === "loading" && <Centered>Preparing mission…</Centered>}

        {phase === "playing" && renderGame({ start, complete })}

        {phase === "submitting" && <Centered>Scoring your run…</Centered>}

        {phase === "result" && result && (
          <ResultView result={result} onReplay={replay} />
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-4">
            <p className="text-bad">{error}</p>
            <button className="btn btn-ghost w-fit" onClick={replay}>
              Back to start
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center text-muted">
      {children}
    </div>
  );
}

function ResultView({
  result,
  onReplay,
}: {
  result: SubmitResult;
  onReplay: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="text-5xl">{result.xpAwarded > 0 ? "🎉" : "✅"}</div>
      <div className="text-lg font-bold">
        Score: <span className="mono">{result.scoreAccepted}</span>
      </div>
      {result.alreadyClaimedToday ? (
        <p className="text-sm text-muted">
          You already claimed this mission today — no XP this run. Come back after
          00:00 UTC. Your best score was updated if you beat it.
        </p>
      ) : (
        <div className="text-2xl font-black text-accent">
          +{result.xpAwarded} XP
        </div>
      )}
      <div className="mono text-sm text-muted">
        Total XP: {result.totalXp.toLocaleString()}
      </div>
      <div className="mt-2 flex gap-3">
        <button className="btn btn-ghost" onClick={onReplay}>
          Play again
        </button>
        <Link className="btn btn-primary" href="/dashboard">
          Mission Control
        </Link>
      </div>
    </div>
  );
}
