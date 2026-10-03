"use client";

import Link from "next/link";
import Image from "next/image";
import { Trophy, Users, PiggyBank, Building2, Sparkles, type LucideIcon } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Reveal } from "@/components/reveal";
import { WalletConnect } from "@/components/wallet-connect";
import { XpBar } from "@/components/xp-bar";
import { CrewBadge } from "@/components/crew-badge";
import { HandleEditor } from "@/components/handle-editor";
import { DevnetFaucet } from "@/components/devnet-faucet";
import { MissionCard } from "@/components/mission-card";
import { StreakCard } from "@/components/streak-card";
import { RankCard } from "@/components/rank-card";
import { GuestButton } from "@/components/guest-button";
import { shortWallet } from "@/lib/format";
import { TOKEN_SYMBOL } from "@/lib/game/economy";

export default function DashboardPage() {
  const { me, loading, refresh } = useSession();

  if (loading) return <Loading />;

  if (!me?.player) {
    return (
      <div className="card card-glow mx-auto mt-10 max-w-md p-8 text-center">
        <div className="float-y flex justify-center">
          <Image
            src="/brand/chimp-logo.png"
            alt=""
            width={72}
            height={72}
            priority
            className="rounded-full drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]"
          />
        </div>
        <h1 className="mt-3 text-xl font-bold">Enter the Arena</h1>
        <p className="mt-2 text-sm text-muted">
          Connect a wallet, or jump in as a guest.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <WalletConnect redirectTo="/dashboard" />
          <GuestButton redirectTo="/dashboard" />
        </div>
      </div>
    );
  }

  const { player, crew, today, week, streak, rank, rename } = me;
  const missionsDone = today.missions.filter((m) => m.completed).length;

  return (
    <div className="flex flex-col gap-8">
      <section className="card card-featured p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <HandleEditor
                current={player.handle}
                freeUntil={rename.freeUntil}
                nextAvailableAt={rename.nextAvailableAt}
                priceChimp={rename.priceChimp}
                onSaved={refresh}
              />
              <CrewBadge crew={crew} />
            </div>
            <p className="mono mt-1 text-xs text-muted">
              {shortWallet(player.wallet)} · joined{" "}
              {new Date(player.createdAt).toLocaleDateString()}
            </p>
            <div className="mt-2">
              <DevnetFaucet />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="stat-tile text-right">
              <div className="text-xs text-muted">Today</div>
              <div className="text-2xl font-bold text-accent">
                +{today.xpEarnedToday}
              </div>
              <div className="text-[11px] text-muted">XP</div>
            </div>
            <div className="stat-tile text-right">
              <div className="text-xs text-muted">This week</div>
              <div className="text-2xl font-bold">
                {week.xp.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted">XP</div>
            </div>
            <div className="stat-tile text-right">
              <div className="text-xs text-muted">Gold</div>
              <div className="text-2xl font-bold text-accent-2">
                {player.gold.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted">spend on boosts soon</div>
            </div>
          </div>
        </div>

        <div className="mt-5 max-w-md">
          <XpBar xp={player.xp} />
          <p className="mt-2 text-xs text-muted">
            XP is your all-time rank. It drives your level, your crew&apos;s
            score, and your daily streak. It doesn&apos;t convert to a token.
          </p>
        </div>

        {!crew && (
          <div
            className="mt-5 rounded-xl border p-4 text-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--accent-3) 40%, transparent)",
              background: "color-mix(in srgb, var(--accent-3) 8%, transparent)",
            }}
          >
            You haven&apos;t joined a crew. Your XP won&apos;t count toward any
            crew score until you do.{" "}
            <Link href="/crews" className="font-semibold text-accent-3 underline">
              Pick a crew →
            </Link>
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StreakCard streak={streak} crewName={crew?.name} />
        <RankCard rank={rank} />
        <div className="card flex flex-col justify-center gap-1 p-5">
          <div className="text-xs text-muted">This week for your crew</div>
          <div className="text-2xl font-bold">
            {week.xp.toLocaleString()}{" "}
            <span className="text-base font-normal text-muted">XP added</span>
          </div>
          <p className="text-xs text-muted">
            {crew
              ? `Every mission and streak day you clear lifts ${crew.name} on the board.`
              : "Join a crew so this counts for something."}
          </p>
        </div>
      </div>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Daily missions</h2>
          <span className="mono text-sm text-muted">
            {missionsDone}/{today.missions.length} cleared · resets 00:00 UTC
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {today.missions.map((m) => (
            <MissionCard key={m.def.slug} status={m} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: "/leaderboard",
            icon: Trophy,
            color: "var(--accent-2)",
            title: "Leaderboards",
            blurb: "See where you and your crew rank globally. Updates live.",
          },
          {
            href: "/crews",
            icon: Users,
            color: "var(--accent-3)",
            title: "Crews",
            blurb: crew ? `You rep ${crew.name}.` : "Choose the crew you'll carry.",
          },
          {
            href: "/bank",
            icon: PiggyBank,
            color: "var(--accent-2)",
            title: "Safu Bank",
            blurb: `${player.gold.toLocaleString()} Gold on hand, plus your ${TOKEN_SYMBOL}.`,
          },
          {
            href: "/market",
            icon: Building2,
            color: "var(--accent-4)",
            title: "Property Market",
            blurb: `Claim territory across the belt. ${rank.propertiesOwned} owned.`,
          },
          {
            href: "/mint",
            icon: Sparkles,
            color: "var(--accent-3)",
            title: "Mint an Astrochimp",
            blurb: `Trade 1,000 ${TOKEN_SYMBOL} for an Astrochimp NFT.`,
          },
        ].map((q, i) => (
          <Reveal key={q.href} delay={i * 0.05}>
            <QuickLink {...q} />
          </Reveal>
        ))}
      </section>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  color,
  title,
  blurb,
}: {
  href: string;
  icon: LucideIcon;
  color: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-3 rounded-2xl border p-5 transition duration-200 hover:-translate-y-1"
      style={{ borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border transition group-hover:scale-110"
        style={{
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
          color,
        }}
      >
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div>
        <div className="flex items-center gap-1.5 text-lg font-semibold">
          {title}
          <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground">
            →
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{blurb}</p>
      </div>
    </Link>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-52 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-52 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-52 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-52 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}
