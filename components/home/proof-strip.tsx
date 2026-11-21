"use client";

import { useEffect, useState } from "react";
import { BUY_CHIMP_URL, CHART_URL, SOLSCAN_TOKEN_URL, SOCIAL_LINKS } from "@/lib/links";
import { Lamp, SectionHeader, tint } from "@/components/hud";
import { Reveal } from "@/components/reveal";

/**
 * Social proof for the homepage (devlog #9). Two rules keep it honest:
 *   1. Every number is a live row count from /api/site-stats.
 *   2. Every "find us on" tile links to the real listing, so anyone can
 *      check it. These are places we're listed or built on, NOT partners -
 *      nobody here endorses us, and the copy never says they do.
 */

interface SiteStats {
  available: true;
  astrochimpsMinted: number;
  propertiesSold: number;
  gamesPlayed: number;
  walletPlayers: number;
}

const X_URL = SOCIAL_LINKS.find((s) => s.name === "X")!.href;

const FIND_US = [
  { name: "Solana", what: "Built on", href: SOLSCAN_TOKEN_URL, note: "Token on Solscan" },
  { name: "Raydium", what: "Trade on", href: BUY_CHIMP_URL, note: "SOL to $CHIMP swap" },
  { name: "DEXTools", what: "Chart on", href: CHART_URL, note: "Live $CHIMP chart" },
  { name: "Phantom", what: "Plays with", href: "https://phantom.com/", note: "Wallet sign-in" },
];

/** Things anyone can verify on-chain or on our X - the receipts. */
const RECEIPTS = [
  {
    title: "Liquidity locked for good",
    blurb: "The Raydium pool was locked permanently on Nov 13, 2026. It can't be pulled.",
    href: "https://x.com/Astrochimpz/status/2121126329558929521",
    cta: "Proof on X",
  },
  {
    title: "Fixed supply, no admin keys",
    blurb: "1 billion $CHIMP, fixed. Mint and freeze authority revoked, ownership renounced. Check it on Solscan.",
    href: SOLSCAN_TOKEN_URL,
    cta: "View on Solscan",
  },
  {
    title: "Building in public",
    blurb: "Follow progress as it happens and talk to the team directly.",
    href: X_URL,
    cta: "Follow on X",
  },
];

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function ProofStrip() {
  const [stats, setStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/site-stats")
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.available) setStats(d as SiteStats);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const tiles = stats
    ? [
        { label: "Astrochimps minted", value: stats.astrochimpsMinted, color: "var(--accent-violet)" },
        { label: "Properties owned by players", value: stats.propertiesSold, color: "var(--accent-3)" },
        { label: "Missions played", value: stats.gamesPlayed, color: "var(--hud-cyan)" },
        { label: "Wallets signed in", value: stats.walletPlayers, color: "var(--good)" },
      ]
    : null;

  return (
    <section className="flex flex-col gap-6">
      <Reveal>
        <SectionHeader title="Live on Solana" aside="real numbers, updated every 5 min" />
      </Reveal>

      {/* live counts - hidden entirely if the stats call fails, never faked */}
      {tiles && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <Reveal key={t.label} delay={i * 0.06}>
              <div className="hud-panel h-full p-5" style={tint(t.color)}>
                <div className="hud-value text-3xl sm:text-4xl" style={{ color: t.color }}>
                  {fmt(t.value)}
                </div>
                <div className="hud-label mt-2 flex items-center gap-2">
                  <Lamp color={t.color} live /> {t.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {/* where we're built and listed */}
      <Reveal>
        <div className="hud-panel grid grid-cols-2 overflow-hidden !p-0 sm:grid-cols-4">
          {FIND_US.map((f) => (
            <a
              key={f.name}
              href={f.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center gap-1 px-3 py-5 text-center transition-colors hover:bg-white/5"
            >
              <span className="hud-label !text-[0.6rem]">{f.what}</span>
              <span className="text-xl font-bold uppercase tracking-wider transition-colors group-hover:text-[color:var(--hud-cyan)]">
                {f.name}
              </span>
              <span className="text-xs text-muted">{f.note}</span>
            </a>
          ))}
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3">
        {RECEIPTS.map((r, i) => (
          <Reveal key={r.title} delay={i * 0.08}>
            <a
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hud-panel group flex h-full flex-col p-5 transition duration-200 hover:-translate-y-1"
              style={tint("var(--good)")}
            >
              <div className="font-bold uppercase tracking-wider">{r.title}</div>
              <p className="mt-1 flex-1 text-sm text-muted">{r.blurb}</p>
              <span className="hud-label mt-3 !text-[color:var(--hud-cyan)] group-hover:underline">
                {r.cta} ▸
              </span>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
