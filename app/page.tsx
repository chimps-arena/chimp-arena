"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { WalletConnect } from "@/components/wallet-connect";
import { GuestButton } from "@/components/guest-button";
import { ChimpTicker } from "@/components/chimp-ticker";
import { OrbitVisual } from "@/components/orbit-visual";
import { Reveal } from "@/components/reveal";
import { CrewMark } from "@/components/glyphs";
import { CREWS } from "@/lib/game/config";

const TRUST_SIGNALS = [
  { label: "Mint authority revoked", blurb: "No new $CHIMP can ever be printed." },
  { label: "Freeze authority revoked", blurb: "Wallets can never be frozen or censored." },
  { label: "Ownership renounced", blurb: "The contract runs on autopilot, enforced by Solana." },
];

const FEATURE_CARDS = [
  {
    n: "01",
    title: "Connect",
    blurb: "One wallet, one signature. That's your identity - no passwords.",
    gradient: "radial-gradient(120% 120% at 20% 20%, #2dd4bf 0%, #1e3a5f 45%, #0c0e20 100%)",
  },
  {
    n: "02",
    title: "Compete",
    blurb: "Clear daily mini-games for XP. One reward per mission per day.",
    gradient: "radial-gradient(120% 120% at 80% 30%, #8b5cf6 0%, #3b2a6e 45%, #0c0e20 100%)",
  },
  {
    n: "03",
    title: "Conquer",
    blurb: "Your XP lifts your crew up the board. Spend $CHIMP on what's next.",
    gradient: "radial-gradient(120% 120% at 50% 80%, #f65ce8 0%, #4a1f52 45%, #0c0e20 100%)",
  },
];

export default function Home() {
  const { me, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me?.player) router.replace("/dashboard");
  }, [loading, me, router]);

  return (
    <div className="flex flex-col gap-20 py-8">
      {/* ---------- hero ---------- */}
      <section className="relative grid gap-14 md:grid-cols-[1fr_1fr] md:items-center">
        <OrbitVisual />

        <div className="flex min-w-0 flex-col gap-5">
          <span className="mono text-xs uppercase tracking-[0.3em] text-muted">
            « $CHIMP · live on Solana
          </span>
          <h1
            className="text-[2rem] leading-[1.1] sm:text-6xl"
            style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
          >
            Run missions.
            <br />
            Rep your crew.
            <br />
            <span className="text-accent-2">Own the jungle.</span>
          </h1>
          <p className="max-w-prose text-muted">
            CHIMP Arena turns daily mini-games into XP, and XP into crew power.
            Spend <span className="text-foreground">$CHIMP</span> on Astrochimps
            and gear. Connect a wallet, pick a side, and climb.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <WalletConnect redirectTo="/dashboard" />
            <GuestButton redirectTo="/dashboard" />
            <Link
              href="/leaderboard"
              className="rounded-full border px-4 py-2 text-sm text-muted transition hover:text-foreground"
              style={{ borderColor: "color-mix(in srgb, var(--border) 80%, transparent)" }}
            >
              View leaderboards →
            </Link>
          </div>
          <p className="text-xs text-muted">
            Wallet sign-in is a free, gasless signature. Or jump straight in as a
            guest.
          </p>
        </div>

        {/* numbered feature rail */}
        <div className="flex min-w-0 flex-col gap-4">
          {FEATURE_CARDS.map((f, i) => (
            <Reveal key={f.n} delay={i * 0.08}>
              <div
                className="flex items-center gap-4 rounded-2xl border p-3"
                style={{
                  borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
                  background: "color-mix(in srgb, var(--surface) 60%, transparent)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div
                  className="h-16 w-20 shrink-0 rounded-xl"
                  style={{ background: f.gradient }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] text-muted" style={{ borderColor: "color-mix(in srgb, var(--border) 80%, transparent)" }}>
                      {f.n}
                    </span>
                    <span className="font-semibold">{f.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{f.blurb}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <ChimpTicker />
      </Reveal>

      {/* ---------- trust strip ---------- */}
      <section className="grid gap-4 sm:grid-cols-3">
        {TRUST_SIGNALS.map((t, i) => (
          <Reveal key={t.label} delay={i * 0.08}>
            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-4" />
                {t.label}
              </div>
              <p className="mt-1 text-sm text-muted">{t.blurb}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ---------- crews ---------- */}
      <section>
        <Reveal>
          <h2 className="text-2xl font-bold sm:text-3xl">Pick your crew</h2>
          <p className="mt-1 max-w-prose text-muted">
            Every point of XP you earn is added to your crew&apos;s score. Four
            crews, one board, no mercy.
          </p>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CREWS.map((c, i) => (
            <Reveal key={c.slug} delay={i * 0.06}>
              <div
                className="group flex h-full flex-col rounded-2xl border p-5 transition duration-200 hover:-translate-y-1"
                style={{ borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}
              >
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border transition group-hover:scale-110"
                  style={{ borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}
                >
                  <CrewMark color={c.color} size={44} />
                </div>
                <div className="mt-3 font-semibold" style={{ color: c.color }}>
                  {c.name}
                </div>
                <p className="mt-1 text-sm text-muted">{c.blurb}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
