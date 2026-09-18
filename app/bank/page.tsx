"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/session-provider";
import { WalletConnect } from "@/components/wallet-connect";
import { GuestButton } from "@/components/guest-button";
import { TOKEN_SYMBOL } from "@/lib/game/economy";

interface LedgerRow {
  id: number;
  delta: number;
  reason: string;
  createdAt: string;
}
interface BankData {
  gold: number;
  ledger: LedgerRow[];
}

function friendlyReason(reason: string): string {
  const [kind, detail] = reason.split(":");
  if (kind === "mission") return `Mission cleared — ${detail}`;
  if (kind === "streak") return `Streak day ${detail}`;
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

  if (loading) return <div className="card h-64 animate-pulse p-6" />;

  if (!me?.player) {
    return (
      <div className="card card-glow mx-auto mt-10 max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Safu Bank</h1>
        <p className="mt-2 text-sm text-muted">
          Connect a wallet, or jump in as a guest, to see your balances.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <WalletConnect redirectTo="/bank" />
          <GuestButton redirectTo="/bank" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-black">Safu Bank</h1>
        <p className="mt-1 text-sm text-muted">
          Your {TOKEN_SYMBOL} and Gold, in one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            ${TOKEN_SYMBOL}
          </div>
          <div className="mt-2 text-3xl font-bold text-accent">
            {isGuest
              ? "—"
              : chimp == null
                ? "…"
                : chimp.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <p className="mt-2 text-xs text-muted">
            {isGuest
              ? "Connect a wallet to hold $CHIMP."
              : "Real, on-chain. Spend it at the Market or on a mint."}
          </p>
          <div className="mt-3 flex gap-2">
            <Link href="/market" className="btn btn-ghost text-xs">
              Market
            </Link>
            <Link href="/mint" className="btn btn-ghost text-xs">
              Mint
            </Link>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            Gold
          </div>
          <div className="mt-2 text-3xl font-bold text-accent-2">
            {(bank?.gold ?? me.player.gold).toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-muted">
            Earned by playing. Off-chain, never a token — boosts to spend it
            on are coming.
          </p>
        </div>
      </div>

      <div className="card p-5">
        <div className="text-sm font-bold">Recent activity</div>
        {!bank || bank.ledger.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            Play a mission to start earning Gold.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border/60">
            {bank.ledger.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-muted">{friendlyReason(row.reason)}</span>
                <span className="mono font-semibold text-accent-2">
                  +{row.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
