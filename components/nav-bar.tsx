"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { WalletConnect } from "@/components/wallet-connect";
import { shortWallet } from "@/lib/format";
import { disconnectPhantom } from "@/lib/phantom";
import { TOKEN_SYMBOL } from "@/lib/game/economy";

const LINKS = [
  { href: "/dashboard", label: "Mission Control" },
  { href: "/leaderboard", label: "Leaderboards" },
  { href: "/crews", label: "Crews" },
  { href: "/mint", label: "Mint" },
];

export function NavBar() {
  const { me, loading, logout } = useSession();
  const pathname = usePathname();
  const player = me?.player ?? null;

  const realWallet =
    player?.wallet && !player.wallet.startsWith("guest_") ? player.wallet : null;
  const [chimp, setChimp] = useState<number | null>(null);
  useEffect(() => {
    if (!realWallet) return;
    let active = true;
    fetch(`/api/chimp-balance?wallet=${realWallet}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && typeof d.uiAmount === "number") setChimp(d.uiAmount);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [realWallet]);

  async function fullDisconnect() {
    await logout();
    await disconnectPhantom();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.08em]"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          <Image
            src="/brand/chimp-logo.png"
            alt=""
            width={28}
            height={28}
            className="rounded-full"
            priority
          />
          <span>CHIMP Arena</span>
        </Link>

        <nav className="ml-4 hidden gap-1 sm:flex">
          {LINKS.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
                style={
                  active
                    ? {
                        boxShadow:
                          "inset 0 0 0 1px color-mix(in srgb, var(--accent-2) 35%, transparent)",
                      }
                    : undefined
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {loading ? null : player ? (
            <>
              {me && me.streak.count >= 2 && (
                <span
                  className="chip mono hidden sm:inline-flex"
                  style={{
                    color: "var(--accent)",
                    borderColor: me.streak.atRisk
                      ? "color-mix(in srgb, var(--accent) 65%, transparent)"
                      : "color-mix(in srgb, var(--accent) 30%, transparent)",
                  }}
                  title={
                    me.streak.atRisk
                      ? "Play today to keep your streak"
                      : `${me.streak.count}-day streak`
                  }
                >
                  🔥 {me.streak.count}
                </span>
              )}
              {realWallet && (
                <span
                  className="chip mono hidden text-accent sm:inline-flex"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--accent) 40%, transparent)",
                  }}
                  title={`Your ${TOKEN_SYMBOL} balance`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  {chimp == null
                    ? "…"
                    : chimp.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                  {TOKEN_SYMBOL}
                </span>
              )}
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold">{player.handle}</div>
                <div className="mono text-xs text-muted">
                  {player.xp.toLocaleString()} XP · {shortWallet(player.wallet)}
                </div>
              </div>
              <button
                className="btn btn-ghost text-sm"
                onClick={() => fullDisconnect()}
              >
                Disconnect
              </button>
            </>
          ) : (
            <WalletConnect label="Connect" />
          )}
        </div>
      </div>
    </header>
  );
}
