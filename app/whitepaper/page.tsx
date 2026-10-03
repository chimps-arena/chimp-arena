import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Whitepaper — CHIMP Arena",
  description: "Astrochimpz ($CHIMP) roadmap and tokenomics.",
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

const ALLOCATION = [
  {
    label: "Treasury",
    pct: 25,
    wallet: "B5QJGdkQ2r14movaf36NNaVmLqNBqqUMdsQPP2GUbCFS",
    short: "Community-governed reserve",
    detail:
      "Held on-chain and operated as a community treasury. Token holders vote - with their wallets - on how funds are appropriated. A republic-style representative model is the aim, but the community always has final say.",
    bullets: [
      "Only community wallets vote (founders, corp & project wallets excluded)",
      "Funds new game levels, character designers, tooling, live-ops",
      "Every proposal & vote settles transparently on Solana",
    ],
  },
  {
    label: "Founders",
    pct: 20,
    wallet: "DrZK5sb5Tixa7VZgMoMLTVv5JXpTSzxeQ1JxvUYSfgmg",
    short: "Distributed to the founding crew",
    detail: "The founding crew's allocation, distributed to the founding team.",
  },
  {
    label: "Ecosystem Rewards",
    pct: 20,
    wallet: "6Vq9GTXWRaTBAZmmDx5fMLqV2Q5meHuaoiCojStQvdvy",
    short: "Player rewards, quests, airdrops",
    detail:
      "Fuels the player economy - in-game rewards, quest payouts, seasonal airdrops, tournaments, and loyalty programs.",
  },
  {
    label: "Community & Partners",
    pct: 15,
    wallet: "6Vq9GTXWRaTBAZmmDx5fMLqV2Q5meHuaoiCojStQvdvy",
    short: "Creators, KOLs, integrations",
    detail:
      "Reserved for creators, content partners, KOLs, and third-party integrations that grow the Astroworld universe.",
  },
  {
    label: "Liquidity",
    pct: 10,
    wallet: "3mGmGvdAqcENBnzEwuTqRuoJwHWrQsVrd79J7PyqAyJV",
    short: "Raydium pool - deep, live, on-chain",
    detail:
      "Listed on Raydium with on-chain liquidity backing every swap. This wallet holds the LP position address.",
  },
  {
    label: "Corporation Reserve",
    pct: 10,
    wallet: "2HJouoXc3KrWULcFqE2t1eQRY2EDjSTWL6KB3bhAQSPU",
    short: "Legal · Dev · Marketing · Infra · Salaries",
    detail:
      "Sustains the project across market cycles. Funds operations, payroll, infrastructure, legal, and growth.",
  },
];

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

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

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ALLOCATION.map((a) => (
            <div key={a.label} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display font-bold">{a.label}</div>
                  <div className="text-sm text-muted">{a.short}</div>
                </div>
                <div className="font-display text-2xl font-black text-accent">
                  {a.pct}%
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{a.detail}</p>
              {a.bullets && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  {a.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              <a
                href={`https://solscan.io/account/${a.wallet}`}
                target="_blank"
                rel="noreferrer"
                className="mono mt-3 inline-block text-[11px] text-muted hover:text-foreground"
                title={a.wallet}
              >
                {short(a.wallet)} ↗
              </a>
            </div>
          ))}
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
