"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { CrewMark } from "@/components/glyphs";
import { Reveal } from "@/components/reveal";
import { Lamp, PageHeader, Readout, tint } from "@/components/hud";
import { CREWS } from "@/lib/game/config";
import type { LeaderboardCrew } from "@/lib/types";

// Per-crew character art: drop a transparent PNG at public/crews/<slug>.png
// and add it here. Until then every crew shows the base Astrochimp.
const DEFAULT_CREW_ART = "/characters/astrochimp-512.png";
const CREW_ART: Record<string, string> = {};

/** Dark text on light crew colours (banana yellow, green), white on the rest. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 140 ? "#140f00" : "#ffffff";
}

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
    <div className="hud flex flex-col gap-6">
      <PageHeader
        kicker="Crew roster · enlistment open"
        title="Pick your crew"
        blurb="Your XP is added to your crew's total. Choose once. Crew changes are locked to keep the rivalry honest."
      />

      {me?.player?.wallet.startsWith("guest_") && (
        <div className="hud-tag !flex !normal-case !tracking-normal p-3 text-sm" style={tint("var(--hud-amber)")}>
          <span className="text-foreground">
            You&apos;re playing as a guest - connect a wallet so your XP counts on the leaderboards and for your crew.
          </span>
        </div>
      )}

      {error && (
        <div className="hud-tag !flex !normal-case !tracking-normal p-3 text-sm" style={tint("var(--bad)")}>
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {CREWS.map((c, i) => {
          const t = totals[c.slug];
          const mine = current === c.slug;
          return (
            <Reveal key={c.slug} delay={i * 0.06}>
              <div
                className="hud-panel flex h-full flex-col gap-4 p-6"
                style={
                  {
                    ...tint(c.color),
                    "--cut": "22px",
                    "--edge": `color-mix(in srgb, ${c.color} ${mine ? 90 : 60}%, transparent)`,
                    boxShadow: `0 0 40px -18px ${c.color}`,
                  } as React.CSSProperties
                }
              >
                {/* crew-lit backdrop + character art (right side, fades left) */}
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(70% 90% at 85% 40%, color-mix(in srgb, ${c.color} 22%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in srgb, ${c.color} 7%, transparent), transparent 60%)`,
                  }}
                />
                <Image
                  src={CREW_ART[c.slug] ?? DEFAULT_CREW_ART}
                  alt=""
                  width={512}
                  height={512}
                  className="pointer-events-none absolute -right-8 -bottom-6 h-[92%] w-auto opacity-25 sm:opacity-95"
                  style={{
                    filter: `drop-shadow(0 0 24px color-mix(in srgb, ${c.color} 55%, transparent))`,
                    maskImage: "linear-gradient(to left, #000 55%, transparent 95%)",
                  }}
                />
                {/* accent notch on the top edge */}
                <span
                  className="pointer-events-none absolute top-0 left-[58%] h-[2px] w-20"
                  style={{ background: c.color, boxShadow: `0 0 12px ${c.color}` }}
                />

                <div className="relative flex items-center justify-between">
                  <span className="hud-tag">
                    Crew-{String(i + 1).padStart(2, "0")}
                    {t && <> · rank #{String(t.rank).padStart(2, "0")}</>}
                  </span>
                  {mine && (
                    <span className="hud-label flex items-center gap-1.5" style={{ color: c.color }}>
                      <Lamp color={c.color} live /> Your crew
                    </span>
                  )}
                </div>

                <div className="relative flex items-center gap-4 sm:max-w-[64%]">
                  <CrewMark slug={c.slug} color={c.color} size={72} active={mine} />
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold uppercase" style={{ color: c.color }}>
                      {c.name}
                    </h2>
                    <p className="mt-1 text-sm text-foreground/80">{c.blurb}</p>
                  </div>
                </div>

                <div
                  className="relative grid grid-cols-2 divide-x border-t pt-3 sm:max-w-[64%]"
                  style={{ borderColor: "var(--hud-edge)" }}
                >
                  <div className="pr-4" style={{ borderColor: "var(--hud-edge)" }}>
                    <Readout label="Total XP" value={t ? t.totalXp.toLocaleString() : "…"} color={c.color} />
                  </div>
                  <div className="pl-4" style={{ borderColor: "var(--hud-edge)" }}>
                    <Readout label="Members" value={t ? t.members : "…"} />
                  </div>
                </div>

                <div className="relative mt-auto pt-1">
                  {mine ? (
                    <span className="hud-btn hud-btn-ghost w-full !cursor-default">✓ Enlisted</span>
                  ) : current ? (
                    <span className="hud-label">Locked · you already rep another crew</span>
                  ) : (
                    <button
                      className="hud-btn w-full !py-3"
                      style={{
                        background: `linear-gradient(180deg, color-mix(in srgb, ${c.color} 78%, white), ${c.color})`,
                        color: inkOn(c.color),
                      }}
                      disabled={!!joining || loading || !me?.player}
                      onClick={() => join(c.slug)}
                    >
                      {joining === c.slug ? "Enlisting…" : "Join crew ▸"}
                    </button>
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
