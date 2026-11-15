"use client";

import { useEffect, useState } from "react";
import { Lamp, SectionHeader, tint } from "@/components/hud";
import type { PriorityBreakdown, PriorityTier } from "@/lib/priority-score";

interface Score {
  score: number;
  tier: PriorityTier;
  breakdown: PriorityBreakdown;
  checkedAt: string;
  nextSteps: string[];
}

// Mirrors TIERS in lib/priority-score.ts (that module is server-only).
const TIER_STYLE: Record<PriorityTier, { label: string; color: string; min: number }> = {
  none: { label: "Unranked", color: "var(--muted)", min: 0 },
  bronze: { label: "Bronze", color: "#d08a4e", min: 25 },
  silver: { label: "Silver", color: "#c3cddb", min: 75 },
  gold: { label: "Gold", color: "var(--hud-amber)", min: 150 },
  platinum: { label: "Platinum", color: "var(--hud-cyan)", min: 250 },
};
const ORDER: PriorityTier[] = ["none", "bronze", "silver", "gold", "platinum"];

const days = (d: number | null) => (d == null ? "—" : `${d.toLocaleString()} days`);

function rows(b: PriorityBreakdown) {
  return [
    { label: "$CHIMP held", fact: b.chimpHeld.amount.toLocaleString(undefined, { maximumFractionDigits: 0 }), points: b.chimpHeld.points },
    { label: "Holding time", fact: days(b.holdingDays.days), points: b.holdingDays.points },
    {
      label: "Astrochimps",
      fact: `${b.astrochimps.count}${b.astrochimps.rare ? ` · ${b.astrochimps.rare} Rare` : ""}${b.astrochimps.oneOfOne ? ` · ${b.astrochimps.oneOfOne} One of One` : ""}`,
      points: b.astrochimps.points,
    },
    { label: "Properties", fact: String(b.properties.count), points: b.properties.points },
    { label: "Wallet age", fact: days(b.walletAgeDays.days), points: b.walletAgeDays.points },
  ];
}

/** Safu Bank's Priority User Score panel (dev log #12). */
export function PriorityScorePanel() {
  const [score, setScore] = useState<Score | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/priority")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setScore(d);
        else setError(d.error ?? "Couldn't load your score.");
      })
      .catch(() => alive && setError("Couldn't load your score."));
    return () => {
      alive = false;
    };
  }, []);

  async function recheck() {
    setChecking(true);
    setError(null);
    const r = await fetch("/api/priority", { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setScore(d);
    else setError(d.error ?? "Couldn't recheck right now.");
    setChecking(false);
  }

  const style = TIER_STYLE[score?.tier ?? "none"];
  const next = score ? ORDER[ORDER.indexOf(score.tier) + 1] : undefined;
  const nextStyle = next ? TIER_STYLE[next] : null;
  const progress = score && nextStyle ? Math.min(100, ((score.score - style.min) / (nextStyle.min - style.min)) * 100) : 100;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Priority score" aside="on-chain · checked daily" />
      <div className="hud-panel flex flex-col gap-5 p-5" style={tint(style.color)}>
        {!score && !error && <div className="h-24 animate-pulse" />}
        {!score && error && <p className="text-sm text-bad">{error}</p>}
        {score && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="hud-label flex items-center gap-2">
                  <Lamp color={style.color} live={score.tier !== "none"} /> Priority tier
                </div>
                <div className="hud-value mt-1 text-4xl uppercase" style={{ color: style.color }}>
                  {style.label}
                </div>
              </div>
              <div className="text-right">
                <div className="hud-label">Score</div>
                <div className="hud-value mt-1 text-4xl">{score.score}</div>
              </div>
            </div>

            {nextStyle && (
              <div>
                <div className="h-1.5 w-full bg-surface-2">
                  <div className="h-full" style={{ width: `${progress}%`, background: nextStyle.color }} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {nextStyle.min - score.score} points to {nextStyle.label}
                </p>
              </div>
            )}

            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--hud-edge)" }}>
              {rows(score.breakdown).map((r) => (
                <li key={r.label} className="flex items-baseline justify-between gap-3 py-2 text-sm" style={{ borderColor: "var(--hud-edge)" }}>
                  <span className="text-muted">{r.label}</span>
                  <span className="mono ml-auto text-xs text-muted">{r.fact}</span>
                  <span className="mono w-12 text-right" style={{ color: r.points ? style.color : undefined }}>
                    +{r.points}
                  </span>
                </li>
              ))}
            </ul>

            {score.nextSteps.length > 0 && (
              <div>
                <div className="hud-label">Raise your score</div>
                <ul className="mt-2 ml-5 list-disc space-y-1 text-sm text-muted">
                  {score.nextSteps.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button className="hud-btn hud-btn-ghost !py-2 !text-[0.7rem]" onClick={recheck} disabled={checking}>
                {checking ? "Checking…" : "Recheck now"}
              </button>
              <span className="text-xs text-muted">
                Last checked {new Date(score.checkedAt).toLocaleString()}
              </span>
              {error && <span className="text-xs text-bad">{error}</span>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
