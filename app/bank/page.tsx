"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/session-provider";
import { WalletConnect } from "@/components/wallet-connect";
import { GuestButton } from "@/components/guest-button";
import { TOKEN_SYMBOL } from "@/lib/game/economy";
import { missionBySlug } from "@/lib/game/config";
import { Lamp, PageHeader, SectionHeader, tint } from "@/components/hud";

type Resource = "gold" | "cobalt" | "palladium" | "crystal";

interface LedgerRow {
  id: string;
  resource: Resource;
  delta: number;
  reason: string;
  createdAt: string;
}
interface BankData {
  gold: number;
  resources: { cobalt: number; palladium: number; crystal: number };
  ledger: LedgerRow[];
}

const RESOURCE_COLOR: Record<Resource, string> = {
  gold: "var(--hud-cyan)",
  cobalt: "#5b8cff",
  palladium: "#cbd5e1",
  crystal: "var(--accent-3)",
};

function friendlyReason(reason: string): string {
  const [kind, detail] = reason.split(":");
  if (kind === "mission") return `Mission cleared: ${detail}`;
  if (kind === "streak") return `Streak day ${detail}`;
  if (kind === "mining") return "Deep Core haul";
  if (kind === "tool") return `Tool upgrade (tier ${detail})`;
  if (kind === "market" && detail === "list") return "Listed on market";
  if (kind === "market" && detail === "cancel") return "Listing cancelled";
  if (kind === "market" && detail === "buy") return "Bought on market";
  return reason;
}

export default function BankPage() {
  const { me, loading } = useSession();
  const [chimp, setChimp] = useState<number | null>(null);
  const [bank, setBank] = useState<BankData | null>(null);

  const wallet = me?.player?.wallet ?? null;
  const isGuest = wallet?.startsWith("guest_") ?? false;

  useEffect(() => {
    if (!wallet || isGuest) return;
    let active = true;
    fetch(`/api/chimp-balance?wallet=${wallet}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && typeof d.uiAmount === "number") setChimp(d.uiAmount);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [wallet, isGuest]);

  useEffect(() => {
    if (!wallet) return;
    let active = true;
    fetch("/api/bank")
      .then((r) => r.json())
      .then((d) => {
        if (active) setBank(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [wallet]);

  if (loading) return <div className="hud-panel h-64 animate-pulse" />;

  if (!me?.player) {
    return (
      <div className="hud">
        <div className="hud-panel mx-auto mt-10 max-w-md p-8 text-center">
          <div className="hud-label">Vault locked</div>
          <h1 className="mt-1 text-2xl font-bold uppercase">Safu Bank</h1>
          <p className="mt-2 text-sm text-muted">
            Connect a wallet, or jump in as a guest, to see your balances.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <WalletConnect redirectTo="/bank" />
            <GuestButton redirectTo="/bank" />
          </div>
        </div>
      </div>
    );
  }

  const player = me.player;

  return (
    <div className="hud mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader kicker="Vault · secure link" title="Safu Bank" blurb={`Your ${TOKEN_SYMBOL}, Gold and ore, in one place.`} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="hud-panel hud-panel-hot flex flex-col gap-3 p-5" style={tint("var(--hud-amber)")}>
          <div className="flex items-center justify-between">
            <span className="hud-label">${TOKEN_SYMBOL} · on-chain</span>
            <Lamp color={isGuest ? "var(--muted)" : "var(--good)"} live={!isGuest} />
          </div>
          <div className="hud-value text-4xl text-[color:var(--hud-amber)]">
            {isGuest
              ? "—"
              : chimp == null
                ? "…"
                : chimp.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted">
            {isGuest
              ? "Connect a wallet to hold $CHIMP."
              : "Real, on-chain. Spend it at the Market or on a mint."}
          </p>
          <div className="mt-auto flex gap-2">
            <Link href="/market" className="hud-btn hud-btn-ghost !px-3 !py-2 !text-[0.7rem]" style={tint("var(--hud-amber)")}>
              Market ▸
            </Link>
            <Link href="/mint" className="hud-btn hud-btn-ghost !px-3 !py-2 !text-[0.7rem]" style={tint("var(--hud-amber)")}>
              Mint ▸
            </Link>
          </div>
        </div>

        <div className="hud-panel flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="hud-label">Gold · off-chain</span>
            <Lamp color="var(--hud-cyan)" />
          </div>
          <div className="hud-value text-4xl text-[color:var(--hud-cyan)]">
            {(bank?.gold ?? player.gold).toLocaleString()}
          </div>
          <p className="text-xs text-muted">
            Earned by playing. Off-chain, never a token. Boosts to spend it on are coming.
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Ore hold" />
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {(["cobalt", "palladium", "crystal"] as const).map((r) => (
            <div key={r} className="hud-panel p-4 sm:p-5" style={tint(RESOURCE_COLOR[r])}>
              <div className="flex items-center gap-1.5">
                <Lamp color={RESOURCE_COLOR[r]} />
                <span className="hud-label">{r}</span>
              </div>
              <div className="hud-value mt-2 text-xl sm:text-2xl" style={{ color: RESOURCE_COLOR[r] }}>
                {(bank?.resources[r] ?? player.resources[r] ?? 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {missionBySlug("mining")?.comingSoon ? (
            <span className="hud-btn hud-btn-ghost !cursor-default" style={tint("var(--muted)")}>
              Mining · coming soon
            </span>
          ) : (
            <Link href="/missions/mining" className="hud-btn">
              Mine for ore ▸
            </Link>
          )}
          <Link href="/market/resources" className="hud-btn hud-btn-ghost">
            Resource market ▸
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Activity log" aside={bank ? `${bank.ledger.length} entries` : undefined} />
        <div className="hud-panel">
          {!bank || bank.ledger.length === 0 ? (
            <p className="p-5 text-xs text-muted">Play a mission to start earning Gold.</p>
          ) : (
            <ul>
              {bank.ledger.map((row) => (
                <li key={row.id} className="hud-row flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="mono w-24 shrink-0 text-[11px] text-muted">
                    {new Date(row.createdAt).toLocaleDateString(undefined, { month: "short", day: "2-digit" })}{" "}
                    {new Date(row.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted">{friendlyReason(row.reason)}</span>
                  <span className="hud-value shrink-0 text-sm" style={{ color: row.delta < 0 ? "var(--bad)" : RESOURCE_COLOR[row.resource] }}>
                    {row.delta > 0 ? "+" : ""}
                    {row.delta} <span className="text-xs font-normal uppercase">{row.resource}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
