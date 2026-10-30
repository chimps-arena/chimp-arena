"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { crewBySlug } from "@/lib/game/config";
import { Flame } from "lucide-react";
import { CrewMark } from "@/components/glyphs";
import { Lamp, tint } from "@/components/hud";
import { shortWallet } from "@/lib/format";
import type { LeaderboardResponse } from "@/lib/types";

type Tab = "players" | "crews";

const RANK_COLOR: Record<number, string> = {
  1: "#ffc23a",
  2: "#cbd5e1",
  3: "#e0894f",
};
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

  if (!data) return <div className="hud-panel h-64 animate-pulse" />;

  const topCrewXp = Math.max(1, ...data.crews.map((c) => c.totalXp));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="hud-switch" role="group" aria-label="Leaderboard">
          {(["crews", "players"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}>
              {t}
            </button>
          ))}
        </div>
        <span className="hud-label flex items-center gap-1.5">
          <Lamp color={live ? "var(--good)" : "var(--muted)"} live={live} />
          <span style={{ color: live ? "var(--good)" : undefined }}>{live ? "Live" : "Polling"}</span>
        </span>
        <span className={`mono ml-auto text-[11px] transition-colors ${flash ? "text-good" : "text-muted"}`}>
          updated {new Date(data.updatedAt).toLocaleTimeString()}
        </span>
      </div>

      {tab === "crews" ? (
        <div className="hud-panel">
          {data.crews.map((c) => (
            <div key={c.slug} className="hud-row flex items-center gap-4 p-4 sm:p-5">
              <RankTag rank={c.rank} />
              <CrewMark slug={c.slug} color={c.color} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <div className="font-bold uppercase tracking-wide" style={{ color: c.color, fontFamily: "var(--font-hud)" }}>
                    {c.name}
                  </div>
                  <div className="hud-value text-lg">
                    {c.totalXp.toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-muted">XP</span>
                  </div>
                </div>
                <div className="hud-gauge mt-2 !h-2.5 !p-[1px]">
                  <div
                    className="hud-gauge-fill"
                    style={{
                      width: `${(c.totalXp / topCrewXp) * 100}%`,
                      background: c.color,
                      filter: `drop-shadow(0 0 6px ${c.color})`,
                    }}
                  />
                </div>
                <div className="mono mt-1 text-[11px] text-muted">
                  {c.members} member{c.members === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
        {data.players.length >= 3 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[data.players[1], data.players[0], data.players[2]].map((p) => (
              <Podium key={p.wallet} player={p} isMe={p.wallet === highlightWallet} />
            ))}
          </div>
        )}
        <div className="hud-panel">
          {data.players.length === 0 && (
            <div className="p-6 text-center text-sm text-muted">
              No players yet. Be the first on the board.
            </div>
          )}
          {data.players.slice(data.players.length >= 3 ? 3 : 0).map((p) => {
            const crew = crewBySlug(p.crewSlug);
            const isMe = highlightWallet && p.wallet === highlightWallet;
            return (
              <div key={p.wallet} className={`hud-row flex items-center gap-4 px-4 py-3${isMe ? " hud-row-me" : ""}`}>
                <RankTag rank={p.rank} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.handle}</span>
                    {p.streak >= 2 && (
                      <span
                        className="mono inline-flex shrink-0 items-center gap-0.5 text-xs text-[color:var(--hud-amber)]"
                        title={`${p.streak}-day streak`}
                      >
                        <Flame className="h-3 w-3" aria-hidden="true" />
                        {p.streak}
                      </span>
                    )}
                    {isMe && (
                      <span className="hud-tag !py-0 shrink-0" style={tint("var(--hud-cyan)")}>
                        you
                      </span>
                    )}
                  </div>
                  <div className="mono text-xs text-muted">
                    {shortWallet(p.wallet)}
                    {crew && <span style={{ color: crew.color }}> · {crew.name}</span>}
                  </div>
                </div>
                <div className="hud-value text-right">
                  {p.xp.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-muted">XP</span>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

/** A top-3 pilot. First place sits in the middle and stands tallest. */
function Podium({ player: p, isMe }: { player: LeaderboardResponse["players"][number]; isMe: boolean }) {
  const color = RANK_COLOR[p.rank] ?? "var(--hud-cyan)";
  const crew = crewBySlug(p.crewSlug);
  return (
    <div
      className={`hud-panel hud-panel-hot flex flex-col items-center gap-2 p-5 text-center ${
        p.rank === 1 ? "sm:order-none sm:-mt-0 sm:pt-8" : "sm:mt-6"
      } ${p.rank === 1 ? "order-first" : ""}`}
      style={{ ...tint(color), "--cut": "18px" } as React.CSSProperties}
    >
      <span className="hud-label" style={{ color }}>
        {p.rank === 1 ? "Top pilot" : `Rank ${String(p.rank).padStart(2, "0")}`}
      </span>
      <span className="hud-value text-5xl" style={{ color, textShadow: `0 0 24px ${color}` }}>
        {String(p.rank).padStart(2, "0")}
      </span>
      <div className="flex max-w-full items-center gap-2">
        <span className="truncate text-lg font-bold" style={{ fontFamily: "var(--font-hud)" }}>
          {p.handle}
        </span>
        {isMe && (
          <span className="hud-tag !py-0 shrink-0" style={tint("var(--hud-cyan)")}>
            you
          </span>
        )}
      </div>
      <div className="mono text-xs text-muted">
        {shortWallet(p.wallet)}
        {crew && <span style={{ color: crew.color }}> · {crew.name}</span>}
      </div>
      <div className="mt-1 border-t pt-2" style={{ borderColor: "var(--hud-edge)" }}>
        <span className="hud-value text-xl">{p.xp.toLocaleString()}</span>
        <span className="ml-1 text-xs text-muted">XP</span>
        {p.streak >= 2 && (
          <span className="mono ml-2 inline-flex items-center gap-0.5 text-xs text-[color:var(--hud-amber)]">
            <Flame className="h-3 w-3" aria-hidden="true" />
            {p.streak}
          </span>
        )}
      </div>
    </div>
  );
}

/** [ #01 ] - gold, silver and bronze for the podium. */
function RankTag({ rank }: { rank: number }) {
  const color = RANK_COLOR[rank];
  return (
    <span
      className="hud-tag w-12 shrink-0 justify-center !text-sm font-bold"
      style={color ? { ...tint(color), boxShadow: `0 0 14px -6px ${color}` } : undefined}
    >
      {String(rank).padStart(2, "0")}
    </span>
  );
}
