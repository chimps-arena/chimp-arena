"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { useSession } from "@/components/session-provider";
import { Lamp, PageHeader, Readout, tint } from "@/components/hud";
import { BUY_CHIMP_URL } from "@/lib/links";
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
  prepareStart,
  startLabel,
}: {
  slug: string;
  title: string;
  subtitle: string;
  instructions: ReactNode;
  renderGame: (ctx: GameContext) => ReactNode;
  /** Awaited before the /start fetch - e.g. mining's permit-purchase check.
   *  Throwing shows the message in the error phase instead of starting. */
  prepareStart?: () => Promise<void>;
  /** Replaces the default "Start mission" button label. */
  startLabel?: string;
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
      if (prepareStart) await prepareStart();
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
  }, [slug, prepareStart]);

  const complete = useCallback(
    async (payload: Record<string, unknown>) => {
      const startToken = start?.startToken as string | undefined;
      if (!startToken) {
        setError("Missing start token. Restart the mission.");
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
    <div className="hud mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/dashboard" className="hud-label w-fit hover:text-foreground">
          ◂ Mission Control
        </Link>
        <PageHeader kicker={`Mission · ${slug.replace("-", " ")}`} title={title} blurb={subtitle} />
      </div>

      <div className="hud-panel p-6">
        {phase === "intro" && (
          <div className="flex flex-col gap-4">
            <div className="hud-label">Briefing</div>
            <div className="text-sm text-muted">{instructions}</div>
            <button className="hud-btn w-fit" onClick={begin}>
              {startLabel ?? "Start mission"}
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
            <div className="hud-label flex items-center gap-2 !text-bad">
              <Lamp color="var(--bad)" live /> Mission aborted
            </div>
            <p className="text-bad">{error}</p>
            <button className="hud-btn hud-btn-ghost w-fit" onClick={replay}>
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
    <div className="hud-label flex h-40 items-center justify-center gap-2">
      <Lamp color="var(--hud-cyan)" live />
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
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="hud-label flex items-center gap-2">
        <Lamp color="var(--good)" live /> Mission complete
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <div className="hud-panel p-4" style={tint("var(--hud-cyan)")}>
          <Readout label="Score" value={result.scoreAccepted} />
        </div>
        <div className="hud-panel p-4" style={tint("var(--accent)")}>
          <Readout
            label="XP earned"
            value={result.alreadyClaimedToday ? "—" : `+${result.xpAwarded}`}
            color={result.alreadyClaimedToday ? undefined : "var(--accent)"}
          />
        </div>
      </div>
      {result.alreadyClaimedToday && (
        <p className="max-w-md text-sm text-muted">
          {result.mining
            ? "XP already claimed today, but ore from this run is still banked."
            : "You already claimed this mission today, so no XP this run. Come back after 00:00 UTC. Your best score was updated if you beat it."}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {result.streak && (
          <span className="hud-tag" style={tint("var(--accent)")}>
            🔥 {result.streak.count}-day streak
            {result.streak.bonusXp > 0 && ` · +${result.streak.bonusXp} bonus`}
            {result.streak.milestoneXp > 0 && ` · +${result.streak.milestoneXp} milestone`}
          </span>
        )}
        {!result.alreadyClaimedToday && result.goldAwarded > 0 && (
          <span className="hud-tag" style={tint("var(--accent-2)")}>
            +{result.goldAwarded} Gold
          </span>
        )}
        {result.mining &&
          (Object.entries(result.mining.found) as [string, number][])
            .filter(([key, n]) => n > 0 && key !== "gold")
            .map(([key, n]) => (
              <span key={key} className="hud-tag" style={tint("var(--accent-violet)")}>
                +{n} {key[0].toUpperCase() + key.slice(1)}
              </span>
            ))}
      </div>
      {result.mining && (
        <p className="mono text-xs text-muted">
          Depth {result.mining.depth} m · {result.mining.zone}
        </p>
      )}
      <div className="mono text-sm text-muted">
        Total XP: {result.totalXp.toLocaleString()}
      </div>
      <div className="mt-1 flex gap-3">
        <button className="hud-btn hud-btn-ghost" onClick={onReplay}>
          Play again
        </button>
        <Link className="hud-btn" href="/dashboard">
          Mission Control
        </Link>
      </div>
      <div
        className="mt-4 w-full max-w-md border p-4"
        style={{
          borderColor: "color-mix(in srgb, var(--hud-amber) 40%, transparent)",
          background: "color-mix(in srgb, var(--hud-amber) 6%, transparent)",
        }}
      >
        <div className="hud-label !text-[color:var(--hud-amber)]">Gear up, pilot</div>
        <p className="mt-1 text-sm text-muted">
          Stack $CHIMP to mint an Astrochimp and claim property across the belt.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a href={BUY_CHIMP_URL} target="_blank" rel="noopener noreferrer" className="hud-btn !px-3 !py-2 !text-[0.7rem]">
            Buy $CHIMP ▸
          </a>
          <Link href="/mint" className="hud-btn hud-btn-ghost !px-3 !py-2 !text-[0.7rem]">
            Mint an Astrochimp ▸
          </Link>
        </div>
      </div>
    </div>
  );
}
