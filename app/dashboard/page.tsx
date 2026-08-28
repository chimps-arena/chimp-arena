"use client";

import Link from "next/link";
import { useSession } from "@/components/session-provider";
import { WalletConnect } from "@/components/wallet-connect";
import { XpBar } from "@/components/xp-bar";
import { CrewBadge } from "@/components/crew-badge";
import { HandleEditor } from "@/components/handle-editor";
import { MissionCard } from "@/components/mission-card";
import { shortWallet } from "@/lib/format";
import { TOKEN_SYMBOL, WEEKLY_CHIMP_POOL } from "@/lib/game/economy";

export default function DashboardPage() {
  const { me, loading, refresh } = useSession();

  if (loading) return <Loading />;

  if (!me?.player) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <div className="text-4xl">🐵</div>
        <h1 className="mt-3 text-xl font-bold">Connect to enter the Arena</h1>
        <p className="mt-2 text-sm text-muted">
          Mission Control needs a connected wallet.
        </p>
        <div className="mt-5 flex justify-center">
          <WalletConnect redirectTo="/dashboard" />
        </div>
      </div>
    );
  }

  const { player, crew, today, week } = me;
  const missionsDone = today.missions.filter((m) => m.completed).length;

  return (
    <div className="flex flex-col gap-8">
      <section className="card p-6">
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
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">
                Today
              </div>
              <div className="text-2xl font-black text-accent">
                +{today.xpEarnedToday}
              </div>
              <div className="text-[11px] text-muted">XP</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">
                This week
              </div>
              <div className="text-2xl font-black">
                {week.xp.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted">
                XP · ≈ {week.projectedChimp.toLocaleString()} {TOKEN_SYMBOL}{" "}
                <span className="rounded bg-surface-2 px-1">projected</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 max-w-md">
          <XpBar xp={player.xp} />
          <p className="mt-2 text-xs text-muted">
            XP is your all-time rank. Each week it converts to a share of the{" "}
            {WEEKLY_CHIMP_POOL.toLocaleString()} {TOKEN_SYMBOL} pool — claims go
            live at token launch.
          </p>
        </div>

        {!crew && (
          <div className="mt-5 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
            You haven&apos;t joined a crew. Your XP won&apos;t count toward any
            crew score until you do.{" "}
            <Link href="/crews" className="font-semibold text-accent underline">
              Pick a crew →
            </Link>
          </div>
        )}
      </section>

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

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/leaderboard" className="card p-5 hover:border-accent/50">
          <div className="text-lg font-bold">🏆 Leaderboards</div>
          <p className="mt-1 text-sm text-muted">
            See where you and your crew rank globally. Updates live.
          </p>
        </Link>
        <Link href="/crews" className="card p-5 hover:border-accent/50">
          <div className="text-lg font-bold">🤝 Crews</div>
          <p className="mt-1 text-sm text-muted">
            {crew ? `You rep ${crew.name}.` : "Choose the crew you'll carry."}
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
