"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { CREWS } from "@/lib/game/config";
import type { LeaderboardCrew } from "@/lib/types";

export default function CrewsPage() {
  const { me, loading, refresh } = useSession();
  const router = useRouter();
  const [totals, setTotals] = useState<Record<string, LeaderboardCrew>>({});
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { crews: LeaderboardCrew[] }) => {
        const map: Record<string, LeaderboardCrew> = {};
        for (const c of d.crews) map[c.slug] = c;
        setTotals(map);
      })
      .catch(() => {});
  }, []);

  const current = me?.player?.crewSlug ?? null;

  async function join(slug: string) {
    setError(null);
    setJoining(slug);
    try {
      const res = await fetch("/api/crew", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ crewSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join");
      await refresh();
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setJoining(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Pick your crew</h1>
        <p className="mt-1 text-muted">
          Your XP is added to your crew&apos;s total. Choose once. Crew changes
          are locked to keep the rivalry honest.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {CREWS.map((c) => {
          const t = totals[c.slug];
          const mine = current === c.slug;
          return (
            <div
              key={c.slug}
              className="card flex flex-col gap-3 p-6 transition duration-200 hover:-translate-y-1"
              style={{
                borderColor: mine
                  ? c.color
                  : `color-mix(in srgb, ${c.color} 35%, transparent)`,
                boxShadow: mine ? `0 0 40px -12px ${c.color}` : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="grid h-14 w-14 place-items-center rounded-2xl text-3xl"
                  style={{
                    background: `color-mix(in srgb, ${c.color} 16%, transparent)`,
                    boxShadow: `0 0 28px -10px ${c.color}`,
                  }}
                >
                  {c.emoji}
                </div>
                {t && (
                  <div className="text-right">
                    <div className="mono text-lg font-bold" style={{ color: c.color }}>
                      {t.totalXp.toLocaleString()} XP
                    </div>
                    <div className="text-xs text-muted">
                      {t.members} member{t.members === 1 ? "" : "s"} · rank #{t.rank}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: c.color }}>
                  {c.name}
                </h2>
                <p className="mt-1 text-sm text-muted">{c.blurb}</p>
              </div>
              <div className="mt-auto pt-2">
                {mine ? (
                  <span className="btn btn-ghost w-full cursor-default">
                    ✓ Your crew
                  </span>
                ) : current ? (
                  <span className="text-xs text-muted">
                    Locked. You already rep another crew.
                  </span>
                ) : (
                  <button
                    className="btn btn-primary w-full"
                    disabled={!!joining || loading || !me?.player}
                    onClick={() => join(c.slug)}
                  >
                    {joining === c.slug ? "Joining…" : `Join ${c.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
