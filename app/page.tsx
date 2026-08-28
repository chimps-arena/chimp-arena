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

export default function Home() {
  const { me, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me?.player) router.replace("/dashboard");
  }, [loading, me, router]);

  return (
    <div className="flex flex-col gap-16 py-8">
      <section className="grid gap-8 md:grid-cols-2 md:items-center">
        <div className="flex flex-col gap-5">
          <span className="w-fit rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            $CHIMP community MVP
          </span>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Run missions. Rep your crew.{" "}
            <span className="text-accent">Climb the leaderboard.</span>
          </h1>
          <p className="max-w-prose text-muted">
            CHIMP Arena is a lean game platform built to grow culture around
            $CHIMP. Connect Phantom, pick a crew, and turn daily mini-games into
            XP that decides who runs the jungle. Adoption first — monetization
            later.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <WalletConnect redirectTo="/dashboard" />
            <Link href="/leaderboard" className="btn btn-ghost">
              View leaderboards
            </Link>
          </div>
          <p className="text-xs text-muted">
            Signing is a free, gasless signature that proves wallet ownership. No
            transaction, no approval.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Today&apos;s missions
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {MISSION_DEFS.map((m) => (
              <li key={m.slug} className="flex items-center gap-3">
                <span className="text-2xl">{MISSION_ICON[m.type]}</span>
                <div>
                  <div className="font-semibold">{m.title}</div>
                  <div className="text-xs text-muted">{m.blurb}</div>
                </div>
                <span className="mono ml-auto text-xs text-accent">
                  +{m.baseXp}+
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Pick your crew</h2>
        <p className="mt-1 text-muted">
          Every point of XP you earn is added to your crew&apos;s score. Crews
          fight for the top of the board.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CREWS.map((c) => (
            <div
              key={c.slug}
              className="card p-5"
              style={{ borderColor: `${c.color}44` }}
            >
              <div className="text-3xl">{c.emoji}</div>
              <div className="mt-2 font-bold" style={{ color: c.color }}>
                {c.name}
              </div>
              <p className="mt-1 text-sm text-muted">{c.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {[
          ["1. Connect", "Phantom wallet, one signature. That's your identity."],
          ["2. Compete", "Clear daily missions for XP. One reward per mission per day."],
          ["3. Conquer", "Your XP lifts your crew up the global leaderboard."],
        ].map(([h, p]) => (
          <div key={h} className="card p-5">
            <div className="font-bold text-accent">{h}</div>
            <p className="mt-1 text-sm text-muted">{p}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
