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
  { href: "/bank", label: "Safu Bank" },
  { href: "/mint", label: "Mint" },
  { href: "/market", label: "Market" },
];

export function NavBar() {
  const { me, loading, logout } = useSession();
  const pathname = usePathname();
  const player = me?.player ?? null;
  const [menuOpen, setMenuOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenuOpen(false), [pathname]);

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
                className="btn btn-ghost hidden text-sm sm:inline-flex"
                onClick={() => fullDisconnect()}
              >
                Disconnect
              </button>
              {/* mobile: icon-only, kept a full gap-3 away from the menu
                  toggle so it can't be mistaken for it */}
              <button
                type="button"
                aria-label="Disconnect"
                onClick={() => fullDisconnect()}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-2 text-muted sm:hidden"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6" />
                  <path d="M10.5 11.5 14 8l-3.5-3.5" />
                  <path d="M14 8H6" />
                </svg>
              </button>
            </>
          ) : (
            <div className="hidden sm:block">
              <WalletConnect label="Connect" />
            </div>
          )}

          {/* mobile menu toggle */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-2 sm:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <path d="M3 3l10 10" />
                  <path d="M13 3L3 13" />
                </>
              ) : (
                <>
                  <path d="M2 4h12" />
                  <path d="M2 8h12" />
                  <path d="M2 12h12" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-border/60 bg-background/95 px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => {
              const active =
                pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    active
                      ? "bg-surface-2 text-foreground"
                      : "text-muted"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            {player ? (
              <>
                <div className="text-sm">
                  <div className="font-semibold">{player.handle}</div>
                  <div className="mono text-xs text-muted">
                    {player.xp.toLocaleString()} XP
                    {realWallet && chimp != null && (
                      <>
                        {" · "}
                        <span className="text-accent">
                          {chimp.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{" "}
                          {TOKEN_SYMBOL}
                        </span>
                      </>
                    )}
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
      )}
    </header>
  );
}
