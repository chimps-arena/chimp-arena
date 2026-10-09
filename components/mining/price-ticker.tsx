"use client";

import { useEffect, useState } from "react";

interface Pool {
  resource: "cobalt" | "palladium" | "crystal";
  reserve: number;
  initialReserve: number;
  price: number;
}

const RESOURCE_LABEL: Record<Pool["resource"], string> = {
  cobalt: "Cobalt",
  palladium: "Palladium",
  crystal: "Crystal",
};

const RESOURCE_DOT: Record<Pool["resource"], string> = {
  cobalt: "#60a5fa",
  palladium: "#e5e7eb",
  crystal: "#c084fc",
};

const POLL_MS = 4000;
const HISTORY_LEN = 24;

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <svg width="64" height="22" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 64;
      const y = 20 - ((v - min) / span) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width="64" height="22" className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Live per-resource price feed for the pool market - polls the same
 * read-only /api/market/pool endpoint the price dashboard uses and keeps a
 * short in-session rolling history to draw a trend line. History resets on
 * reload (nothing is persisted server-side for this) - it's a "what's
 * moving right now" readout, not a historical chart.
 */
export function PriceTicker({ compact = false }: { compact?: boolean }) {
  const [pools, setPools] = useState<Pool[] | null>(null);
  const [history, setHistory] = useState<Record<string, number[]>>({});

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/market/pool");
        const data = await res.json();
        if (!active) return;
        const next: Pool[] = data.pools ?? [];
        setHistory((prev) => {
          const updated: Record<string, number[]> = { ...prev };
          for (const p of next) {
            const hist = [...(updated[p.resource] ?? []), p.price];
            if (hist.length > HISTORY_LEN) hist.shift();
            updated[p.resource] = hist;
          }
          return updated;
        });
        setPools(next);
      } catch {
        // transient fetch failure - keep showing the last good snapshot
      }
    };
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!pools) {
    return (
      <div className={compact ? "flex flex-col gap-2" : "grid gap-4 sm:grid-cols-3"}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`card animate-pulse ${compact ? "h-16" : "h-32"}`} />
        ))}
      </div>
    );
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "grid gap-4 sm:grid-cols-3"}>
      {pools.map((p) => {
        const hist = history[p.resource] ?? [p.price];
        const first = hist[0] ?? p.price;
        const pctChange = first ? ((p.price - first) / first) * 100 : 0;
        const scarcity = p.reserve / p.initialReserve;
        const fillPct = Math.max(0, Math.min(1, scarcity));
        const trendColor = pctChange > 0.05 ? "#4ade80" : pctChange < -0.05 ? "#ff5470" : "#8b93a7";

        if (compact) {
          return (
            <div key={p.resource} className="card flex items-center gap-3 p-3">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: RESOURCE_DOT[p.resource] }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold">{RESOURCE_LABEL[p.resource]}</span>
                  <span className="text-xs font-bold text-accent">
                    {p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${fillPct * 100}%`,
                      background: fillPct < 0.3 ? "#ff5470" : "color-mix(in srgb, var(--accent) 70%, transparent)",
                    }}
                  />
                </div>
              </div>
              <Sparkline values={hist} color={trendColor} />
            </div>
          );
        }

        return (
          <div key={p.resource} className="card p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.14em] text-muted">
                {RESOURCE_LABEL[p.resource]}
              </div>
              <Sparkline values={hist} color={trendColor} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-accent">
                {p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-sm font-normal text-muted">$CHIMP / unit</span>
              {hist.length > 1 && (
                <span className="text-xs font-semibold" style={{ color: trendColor }}>
                  {pctChange > 0 ? "+" : ""}
                  {pctChange.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${fillPct * 100}%`,
                  background: fillPct < 0.3 ? "#ff5470" : "color-mix(in srgb, var(--accent) 70%, transparent)",
                }}
              />
            </div>
            <div className="mt-2 text-xs text-muted">
              {p.reserve.toLocaleString()} available
              {scarcity < 0.5 && <span className="ml-1 text-bad">· running low</span>}
              {scarcity > 1.5 && <span className="ml-1 text-good">· plentiful</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
