"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { crewBySlug } from "@/lib/game/config";
import { shortWallet } from "@/lib/format";
import type { LeaderboardResponse } from "@/lib/types";

type Tab = "players" | "crews";

const RANK_COLOR: Record<number, string> = {
  1: "#ffd23f",
  2: "#cbd5e1",
  3: "#e0894f",
};
function rankStyle(rank: number) {
  const c = RANK_COLOR[rank];
  return c
    ? { color: c, textShadow: `0 0 12px color-mix(in srgb, ${c} 60%, transparent)` }
    : undefined;
}

export function LeaderboardTables({
  initial,
  highlightWallet,
}: {
  initial: LeaderboardResponse | null;
  highlightWallet?: string | null;
}) {
  const [data, setData] = useState<LeaderboardResponse | null>(initial);
  const [tab, setTab] = useState<Tab>("crews");
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      const next = (await res.json()) as LeaderboardResponse;
      setData(next);
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    } catch {
      /* keep previous data */
    }
  }, []);

  // Debounced refetch shared by realtime events + polling fallback.
  const scheduleLoad = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 400);
  }, [load]);

  useEffect(() => {
    // load() awaits fetch before setState, so this is not a synchronous update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!initial) void load();
  }, [initial, load]);

  useEffect(() => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel("arena-leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        scheduleLoad,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_runs" },
        scheduleLoad,
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    const poll = setInterval(load, 20_000);
    return () => {
      clearInterval(poll);
      sb.removeChannel(channel);
    };
  }, [load, scheduleLoad]);

  if (!data) return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex rounded-xl border border-border bg-surface-2 p-1">
          {(["crews", "players"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
                tab === t ? "text-[#241a00]" : "text-muted hover:text-foreground"
              }`}
              style={
                tab === t
                  ? {
                      background:
                        "linear-gradient(180deg, #ffde6b, var(--accent))",
                      boxShadow: "var(--glow-yellow)",
                    }
                  : undefined
              }
            >
              {t}
            </button>
          ))}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-xs ${
            live ? "text-good" : "text-muted"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              live ? "bg-good" : "bg-muted"
            } ${flash ? "pulse-ring" : ""}`}
          />
          {live ? "Live" : "Polling"}
        </span>
        <span className="mono ml-auto text-[11px] text-muted">
          updated {new Date(data.updatedAt).toLocaleTimeString()}
        </span>
      </div>

      {tab === "crews" ? (
        <div className="card divide-y divide-border/60">
          {data.crews.map((c) => (
            <div key={c.slug} className="flex items-center gap-4 p-4">
              <span
                className="mono w-8 text-center text-lg font-black text-muted"
                style={rankStyle(c.rank)}
              >
                {c.rank}
              </span>
              <span className="text-2xl">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold" style={{ color: c.color }}>
                  {c.name}
                </div>
                <div className="text-xs text-muted">
                  {c.members} member{c.members === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mono text-right text-lg font-bold">
                {c.totalXp.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-muted">XP</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-border/60">
          {data.players.length === 0 && (
            <div className="p-6 text-center text-sm text-muted">
              No players yet. Be the first on the board.
            </div>
          )}
          {data.players.map((p) => {
            const crew = crewBySlug(p.crewSlug);
            const isMe = highlightWallet && p.wallet === highlightWallet;
            return (
              <div
                key={p.wallet}
                className="flex items-center gap-4 p-3.5"
                style={
                  isMe
                    ? {
                        background:
                          "color-mix(in srgb, var(--accent-2) 10%, transparent)",
                        boxShadow:
                          "inset 3px 0 0 0 var(--accent-2)",
                      }
                    : undefined
                }
              >
                <span
                  className="mono w-8 text-center font-black text-muted"
                  style={rankStyle(p.rank)}
                >
                  {p.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {p.handle}
                    {p.streak >= 2 && (
                      <span
                        className="mono ml-2 text-xs"
                        style={{ color: "var(--accent)" }}
                        title={`${p.streak}-day streak`}
                      >
                        🔥{p.streak}
                      </span>
                    )}
                    {isMe && (
                      <span className="ml-2 text-xs text-accent-2">you</span>
                    )}
                  </div>
                  <div className="mono text-xs text-muted">
                    {shortWallet(p.wallet)}
                    {crew && (
                      <span style={{ color: crew.color }}> · {crew.emoji} {crew.name}</span>
                    )}
                  </div>
                </div>
                <div className="mono text-right font-bold">
                  {p.xp.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-muted">XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
