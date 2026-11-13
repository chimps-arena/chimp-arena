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
import { Lamp, SectionHeader, tint } from "@/components/hud";
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
    color: "var(--hud-cyan)",
  },
  {
    n: "02",
    title: "Compete",
    blurb: "Clear daily mini-games for XP. One reward per mission per day.",
    color: "var(--accent-violet)",
  },
  {
    n: "03",
    title: "Conquer",
    blurb: "Your XP lifts your crew up the board. Spend $CHIMP on what's next.",
    color: "var(--accent-3)",
  },
];

export default function Home() {
  const { me, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me?.player) router.replace("/dashboard");
  }, [loading, me, router]);

  return (
    <div className="hud flex flex-col gap-20 py-8">
      {/* ---------- hero ---------- */}
      <section className="relative grid gap-14 md:grid-cols-[1fr_1fr] md:items-center">
        <OrbitVisual />

        <div className="flex min-w-0 flex-col gap-5">
          <span className="hud-label flex items-center gap-2">
            <Lamp color="var(--good)" live /> Astrochimpz · $CHIMP live on Solana
          </span>
          <h1 className="text-[2.1rem] font-bold uppercase leading-[1.05] sm:text-6xl">
            Run missions.
            <br />
            Rep your crew.
            <br />
            <span className="text-[color:var(--hud-cyan)]">Own the belt.</span>
          </h1>
          <p className="max-w-prose text-muted">
            Astrochimpz turns daily mini-games into XP, and XP into crew power.
            Spend <span className="text-foreground">$CHIMP</span> on Astrochimps
            and gear. Connect a wallet, pick a side, and climb.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <WalletConnect redirectTo="/dashboard" />
            <GuestButton redirectTo="/dashboard" />
            <Link href="/leaderboard" className="hud-btn hud-btn-ghost !py-2 !text-[0.7rem]">
              Leaderboards ▸
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
              <div className="hud-panel flex items-center gap-4 p-4" style={tint(f.color)}>
                <span className="hud-value w-12 shrink-0 text-center text-3xl" style={{ color: f.color }}>
                  {f.n}
                </span>
                <div className="min-w-0">
                  <div className="font-bold uppercase tracking-wider">{f.title}</div>
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
            <div className="hud-panel h-full p-5" style={tint("var(--good)")}>
              <div className="hud-label flex items-center gap-2 !text-foreground">
                <Lamp color="var(--good)" />
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
          <SectionHeader title="Pick your crew" aside="4 crews · 1 board" />
          <p className="mt-3 max-w-prose text-muted">
            Every point of XP you earn is added to your crew&apos;s score. Four
            crews, one board, no mercy.
          </p>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CREWS.map((c, i) => (
            <Reveal key={c.slug} delay={i * 0.06}>
              <div
                className="hud-panel group flex h-full flex-col p-5 transition duration-200 hover:-translate-y-1"
                style={tint(c.color)}
              >
                <div className="w-fit transition group-hover:scale-110">
                  <CrewMark slug={c.slug} color={c.color} size={56} />
                </div>
                <div className="mt-3 font-bold uppercase tracking-wider" style={{ color: c.color }}>
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
