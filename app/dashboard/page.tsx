"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/components/session-provider";
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

  const { player, crew, today, week, streak, rank } = me;
  const missionsDone = today.missions.filter((m) => m.completed).length;

  return (
    <div className="flex flex-col gap-8">
      <section className="card card-featured p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <HandleEditor current={player.handle} onSaved={refresh} />
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
        <Link
          href="/leaderboard"
          className="card hoverglow-cyan p-5 transition duration-200 hover:-translate-y-1"
        >
          <div className="text-lg font-bold">Leaderboards</div>
          <p className="mt-1 text-sm text-muted">
            See where you and your crew rank globally. Updates live.
          </p>
        </Link>
        <Link
          href="/crews"
          className="card hoverglow-magenta p-5 transition duration-200 hover:-translate-y-1"
        >
          <div className="text-lg font-bold">Crews</div>
          <p className="mt-1 text-sm text-muted">
            {crew ? `You rep ${crew.name}.` : "Choose the crew you'll carry."}
          </p>
        </Link>
        <Link
          href="/bank"
          className="card hoverglow-cyan p-5 transition duration-200 hover:-translate-y-1"
        >
          <div className="text-lg font-bold">Safu Bank</div>
          <p className="mt-1 text-sm text-muted">
            {player.gold.toLocaleString()} Gold on hand, plus your {TOKEN_SYMBOL}.
          </p>
        </Link>
        <Link
          href="/market"
          className="card hoverglow-cyan p-5 transition duration-200 hover:-translate-y-1"
        >
          <div className="text-lg font-bold">Property Market</div>
          <p className="mt-1 text-sm text-muted">
            Claim territory across the belt. {rank.propertiesOwned} owned.
          </p>
        </Link>
        <Link
          href="/mint"
          className="card hoverglow-magenta p-5 transition duration-200 hover:-translate-y-1"
        >
          <div className="text-lg font-bold">Mint an Astrochimp</div>
          <p className="mt-1 text-sm text-muted">
            Trade 1,000 {TOKEN_SYMBOL} for an Astrochimp NFT.
          </p>
        </Link>
      </section>
    </div>
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
