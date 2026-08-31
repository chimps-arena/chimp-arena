"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { WalletConnect } from "@/components/wallet-connect";
import { CREWS, MISSION_DEFS } from "@/lib/game/config";
import type { MissionType } from "@/lib/types";

const MISSION_ICON: Record<MissionType, string> = {
  reaction: "⚡",
  trivia: "🧠",
  "astro-run": "🚀",
  dodge: "☄️",
};

const MISSION_COLOR: Record<MissionType, string> = {
  reaction: "var(--accent)",
  trivia: "var(--accent-2)",
  "astro-run": "var(--accent-3)",
  dodge: "var(--accent-4)",
};

export default function Home() {
  const { me, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me?.player) router.replace("/dashboard");
  }, [loading, me, router]);

  return (
    <div className="flex flex-col gap-20 py-8">
      {/* ---------- hero ---------- */}
      <section className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="flex flex-col gap-5">
          <span className="chip w-fit text-accent-2" style={{ borderColor: "color-mix(in srgb, var(--accent-2) 40%, transparent)" }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-2" />
            $CHIMP community MVP · devnet
          </span>
          <h1 className="text-4xl font-bold leading-[1.05] sm:text-6xl">
            Run missions.<br />
            Rep your crew.<br />
            <span className="text-accent-2">Own the jungle.</span>
          </h1>
          <p className="max-w-prose text-muted">
            CHIMP Arena turns daily mini-games into XP, and XP into crew power.
            Soon, playing also earns a share of the weekly{" "}
            <span className="text-foreground">$CHIMP</span> pool. Connect a
            wallet, pick a side, and climb.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <WalletConnect redirectTo="/dashboard" />
            <Link href="/leaderboard" className="btn btn-neon">
              View leaderboards
            </Link>
          </div>
          <p className="text-xs text-muted">
            Sign-in is a free, gasless signature. No transaction, no approval.
          </p>
        </div>

        {/* mascot + mission preview */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-4 -z-0 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(246,92,232,0.5), transparent 70%)" }}
          />
          <div className="float-y mb-4 text-center text-[5.5rem] leading-none drop-shadow-[0_0_30px_rgba(34,211,238,0.45)]">
            🐵
          </div>
          <div className="card card-featured p-5">
            <h2 className="text-sm font-semibold text-muted">
              Today&apos;s missions
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {MISSION_DEFS.map((m) => (
                <li key={m.slug} className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
                    style={{
                      background: `color-mix(in srgb, ${MISSION_COLOR[m.type]} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${MISSION_COLOR[m.type]} 40%, transparent)`,
                    }}
                  >
                    {MISSION_ICON[m.type]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.title}</div>
                    <div className="truncate text-xs text-muted">{m.blurb}</div>
                  </div>
                  <span
                    className="mono ml-auto shrink-0 text-xs font-semibold"
                    style={{ color: MISSION_COLOR[m.type] }}
                  >
                    +{m.baseXp}+
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- crews ---------- */}
      <section>
        <h2 className="text-2xl font-bold sm:text-3xl">Pick your crew</h2>
        <p className="mt-1 max-w-prose text-muted">
          Every point of XP you earn is added to your crew&apos;s score. Four
          crews, one board, no mercy.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CREWS.map((c) => (
            <div
              key={c.slug}
              className="card group p-5 transition duration-200 hover:-translate-y-1"
              style={{
                borderColor: `color-mix(in srgb, ${c.color} 45%, transparent)`,
              }}
            >
              <div
                className="grid h-11 w-11 place-items-center rounded-xl text-2xl transition group-hover:scale-110"
                style={{
                  background: `color-mix(in srgb, ${c.color} 16%, transparent)`,
                  boxShadow: `0 0 24px -8px ${c.color}`,
                }}
              >
                {c.emoji}
              </div>
              <div className="mt-3 font-bold" style={{ color: c.color }}>
                {c.name}
              </div>
              <p className="mt-1 text-sm text-muted">{c.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["01", "Connect", "One wallet, one signature. That's your identity. No passwords.", "var(--accent-2)"],
          ["02", "Compete", "Clear daily mini-games for XP. One reward per mission per UTC day.", "var(--accent-3)"],
          ["03", "Conquer", "Your XP lifts your crew up the global board, and earns $CHIMP weekly.", "var(--accent)"],
        ].map(([n, h, p, color]) => (
          <div key={h} className="card p-5">
            <div
              className="font-mono text-sm font-bold"
              style={{ color }}
            >
              {n}
            </div>
            <div className="mt-1 text-lg font-bold">{h}</div>
            <p className="mt-1 text-sm text-muted">{p}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
