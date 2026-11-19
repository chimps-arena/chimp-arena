import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Whitepaper",
  description: "Astrochimpz ($CHIMP) whitepaper: the game, the roadmap and the tokenomics.",
  alternates: { canonical: "/whitepaper" },
};

/**
 * Ported verbatim (wording + allocation data + wallet addresses) from the
 * astrochimpz.com marketing site ahead of the domain migration - see
 * app/legal/page.tsx for why this isn't a rewrite. Allocation wallets here
 * are cross-checked against lib/chain/mint-config.ts: Corporation Reserve
 * below is the same address as ASTRO_CORP_WALLET.
 */
const PHASES = [
  {
    name: "Token Launch",
    blurb: "$CHIMP live on Solana. Raydium liquidity. Community forms.",
    status: "Complete" as const,
  },
  {
    name: "NFT Characters",
    blurb: "Astrochimp NFTs - tradable, upgradeable, on-chain stats.",
    status: "In Progress" as const,
  },
  {
    name: "Astroworld",
    blurb: "The social hub. Player interaction, ownership, on-chain trading.",
    status: "Upcoming" as const,
  },
  {
    name: "Full Game Universe",
    blurb: "Galactic exploration. Gold. Raids. Territory defence.",
    status: "Upcoming" as const,
  },
];

const STATUS_STYLE: Record<string, string> = {
  Complete: "text-good border-good/30",
  "In Progress": "text-accent border-accent/40",
  Upcoming: "text-muted border-border",
};

export default function WhitepaperPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mono mb-2 text-xs uppercase tracking-widest text-accent">Whitepaper</div>
      <h1 className="font-display text-5xl font-black md:text-6xl">
        Astrochimpz ($CHIMP)
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        A player-owned space economy on Solana. This page covers the roadmap
        and token allocation - see{" "}
        <Link href="/legal" className="text-accent underline">
          the Legal page
        </Link>{" "}
        for the full disclaimer.
      </p>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-black md:text-3xl">Roadmap</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {PHASES.map((p) => (
            <div key={p.name} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="font-display font-bold">{p.name}</div>
                <span
                  className={`chip mono shrink-0 text-[11px] ${STATUS_STYLE[p.status]}`}
                >
                  {p.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-black md:text-3xl">Tokenomics</h2>
        <p className="mt-3 text-muted">
          <b>Total Supply:</b> 1 billion CHIMP, fixed. Mint authority revoked -
          no new CHIMP can ever be printed. Freeze authority revoked - wallets
          cannot be censored. Ownership renounced - the contract is on
          autopilot, enforced by Solana.
        </p>

        <div className="card mt-6 p-5">
          <div className="mono text-xs uppercase tracking-widest text-accent">Coming soon</div>
          <div className="mt-1 font-display text-xl font-bold">Updated token split</div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            We&apos;re finalizing a new allocation together with token locks,
            pending attorney review and the proper legal filings. The final
            split will be published here with every wallet and lock address, so
            anyone can verify it on-chain.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Already done: the Raydium liquidity pool was locked permanently on
            Nov 13, 2026, so it can&apos;t be pulled.{" "}
            <a
              href="https://x.com/Astrochimpz/status/2121126329558929521"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              Proof on X
            </a>
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-black md:text-3xl">
          Governance & Revenue
        </h2>
        <p className="mt-3 text-muted">
          Wallet-weighted voting lets holders direct the community treasury.
          Founder and corporate wallets are excluded from voting - community
          members make the final call on funding proposals. Voting is purely
          advisory governance over the community treasury; it does not grant
          ownership, control, or management rights in the Astrochimpz
          corporation.
        </p>
        <p className="mt-3 text-muted">
          Revenue model: 1% to the Community Treasury, 2% to the Corporation,
          funding development and operations. The corporation does not
          distribute profits, dividends, or revenue to CHIMP holders. CHIMP is
          a utility and community token, not a security or equity instrument.
        </p>
      </section>
    </div>
  );
}
