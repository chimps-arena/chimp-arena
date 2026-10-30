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
import { Lamp, Readout, SectionHeader, tint } from "@/components/hud";
import { shortWallet } from "@/lib/format";
import { TOKEN_SYMBOL } from "@/lib/game/economy";

export default function DashboardPage() {
  const { me, loading, refresh } = useSession();

  if (loading) return <Loading />;

  if (!me?.player) {
    return (
      <div className="hud">
        <div className="hud-panel mx-auto mt-10 max-w-md p-8 text-center">
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
          <div className="hud-label mt-4">Access required</div>
          <h1 className="mt-1 text-2xl font-bold uppercase">Enter the Arena</h1>
          <p className="mt-2 text-sm text-muted">Connect a wallet, or jump in as a guest.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <WalletConnect redirectTo="/dashboard" />
            <GuestButton redirectTo="/dashboard" />
          </div>
        </div>
      </div>
    );
  }

  const { player, crew, today, week, streak, rank, rename } = me;
  const playable = today.missions.filter((m) => !m.def.comingSoon);
  const missionsDone = playable.filter((m) => m.completed).length;

  return (
    <div className="hud flex flex-col gap-8">
      {/* ---------- pilot console ---------- */}
      <section className="hud-panel p-6" style={{ "--cut": "22px" } as React.CSSProperties}>
        <div className="hud-label flex items-center gap-2">
          <Lamp color="var(--good)" live />
          Mission Control · pilot online
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
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
            <p className="mono mt-2 text-xs uppercase text-muted">
              ID {shortWallet(player.wallet)} · enlisted {new Date(player.createdAt).toLocaleDateString()}
            </p>
            <div className="mt-2">
              <DevnetFaucet />
            </div>
          </div>

          <div
            className="grid grid-cols-3 divide-x border-y py-3"
            style={{ borderColor: "var(--hud-edge)" }}
          >
            <div className="px-3 sm:px-4" style={{ borderColor: "var(--hud-edge)" }}>
              <Readout label="Today" value={`+${today.xpEarnedToday}`} unit="XP" color="var(--hud-amber)" />
            </div>
            <div className="px-3 sm:px-4" style={{ borderColor: "var(--hud-edge)" }}>
              <Readout label="This week" value={week.xp.toLocaleString()} unit="XP" />
            </div>
            <div className="px-3 sm:px-4" style={{ borderColor: "var(--hud-edge)" }}>
              <Readout label="Gold" value={player.gold.toLocaleString()} color="var(--hud-cyan)" />
            </div>
          </div>
        </div>

        <div className="mt-6 max-w-lg">
          <XpBar xp={player.xp} />
          <p className="mt-2 text-xs text-muted">
            XP is your all-time rank. It drives your level, your crew&apos;s score, and your daily
            streak. It doesn&apos;t convert to a token.
          </p>
        </div>

        {!crew && (
          <div
            className="mt-5 flex items-center gap-3 border p-3 text-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--hud-amber) 45%, transparent)",
              background: "color-mix(in srgb, var(--hud-amber) 7%, transparent)",
            }}
          >
            <Lamp color="var(--hud-amber)" live />
            <span>
              No crew assigned - your XP won&apos;t count toward any crew score.{" "}
              <Link href="/crews" className="font-semibold text-[color:var(--hud-amber)] underline">
                Pick a crew ▸
              </Link>
            </span>
          </div>
        )}
      </section>

      {/* ---------- status ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StreakCard streak={streak} crewName={crew?.name} />
        <RankCard rank={rank} />
        <div className="hud-panel flex flex-col gap-3 p-5">
          <span className="hud-label">Crew contribution · this week</span>
          <Readout label="XP added" value={week.xp.toLocaleString()} color="var(--hud-cyan)" />
          <p className="text-xs text-muted">
            {crew
              ? `Every mission and streak day you clear lifts ${crew.name} on the board.`
              : "Join a crew so this counts for something."}
          </p>
        </div>
      </div>

      {/* ---------- missions ---------- */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Daily missions"
          aside={`${missionsDone}/${playable.length} cleared · reset 00:00 UTC`}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {today.missions.map((m, i) => (
            <MissionCard key={m.def.slug} status={m} index={i} />
          ))}
        </div>
      </section>

      {/* ---------- ship systems ---------- */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Ship systems" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: "/leaderboard",
              icon: Trophy,
              color: "var(--hud-cyan)",
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
              color: "var(--hud-amber)",
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
              color: "var(--accent-violet)",
              title: "Mint an Astrochimp",
              blurb: `Trade 1,000 ${TOKEN_SYMBOL} for an Astrochimp NFT.`,
            },
          ].map((q, i) => (
            <Reveal key={q.href} delay={i * 0.05}>
              <SystemLink {...q} code={`SYS-${String(i + 1).padStart(2, "0")}`} />
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

function SystemLink({
  href,
  icon: Icon,
  color,
  title,
  blurb,
  code,
}: {
  href: string;
  icon: LucideIcon;
  color: string;
  title: string;
  blurb: string;
  code: string;
}) {
  return (
    <Link href={href} className="hud-panel group flex h-full items-start gap-4 p-5" style={tint(color)}>
      <span className="hud-well">
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mono text-[11px] text-muted">{code}</div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold uppercase">{title}</h3>
          <span className="text-muted transition group-hover:translate-x-0.5" style={{ color }}>
            ▸
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{blurb}</p>
      </div>
    </Link>
  );
}

function Loading() {
  return (
    <div className="hud flex flex-col gap-4">
      <div className="hud-panel h-40 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="hud-panel h-52 animate-pulse" />
        <div className="hud-panel h-52 animate-pulse" />
        <div className="hud-panel h-52 animate-pulse" />
        <div className="hud-panel h-52 animate-pulse" />
      </div>
    </div>
  );
}
