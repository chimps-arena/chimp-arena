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
import { Flame } from "lucide-react";
import { Lamp, tint } from "@/components/hud";

const LINKS = [
  { href: "/dashboard", label: "Mission Control" },
  { href: "/leaderboard", label: "Leaderboards" },
  { href: "/crews", label: "Crews" },
  { href: "/bank", label: "Safu Bank" },
  { href: "/mint", label: "Mint" },
  { href: "/market", label: "Market" },
  { href: "/my-assets", label: "My Assets" },
  { href: "/whitepaper", label: "Whitepaper" },
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
    <header
      className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl"
      style={{ borderColor: "var(--hud-edge)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-bold uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-hud), sans-serif" }}
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

        <div className="ml-auto flex items-center gap-3">
          {loading ? null : player ? (
            <>
              {me && me.streak.count >= 2 && (
                <span
                  className="hud-tag hidden sm:inline-flex"
                  style={{
                    ...tint("var(--hud-amber)"),
                    ...(me.streak.atRisk ? { boxShadow: "0 0 12px -4px var(--hud-amber)" } : {}),
                  }}
                  title={
                    me.streak.atRisk
                      ? "Play today to keep your streak"
                      : `${me.streak.count}-day streak`
                  }
                >
                  <Flame className="h-3 w-3" aria-hidden="true" /> {me.streak.count}
                </span>
              )}
              {realWallet && (
                <span
                  className="hud-tag hidden sm:inline-flex"
                  style={tint("var(--hud-amber)")}
                  title={`Your ${TOKEN_SYMBOL} balance`}
                >
                  <Lamp color="var(--hud-amber)" />
                  {chimp == null
                    ? "…"
                    : chimp.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                  {TOKEN_SYMBOL}
                </span>
              )}
              <div className="hidden text-right sm:block">
                <div className="text-sm font-bold" style={{ fontFamily: "var(--font-hud), sans-serif" }}>
                  {player.handle}
                </div>
                <div className="mono text-xs text-muted">
                  {player.xp.toLocaleString()} XP · {shortWallet(player.wallet)}
                </div>
              </div>
              <button
                className="hud-btn hud-btn-ghost hidden !px-3 !py-2 !text-[0.7rem] sm:inline-flex"
                style={tint("var(--muted)")}
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
                className="grid h-9 w-9 place-items-center border bg-surface-2 text-muted sm:hidden"
                style={{ borderColor: "var(--hud-edge)" }}
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
            className="grid h-9 w-9 place-items-center border bg-surface-2 sm:hidden"
            style={{ borderColor: "var(--hud-edge)" }}
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

      {/* desktop: console tab strip */}
      <nav
        className="hidden border-t sm:block"
        style={{ borderColor: "color-mix(in srgb, var(--hud-edge) 55%, transparent)" }}
      >
        <div className="mx-auto flex max-w-6xl overflow-x-auto px-4 sm:px-6">
          {LINKS.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`hud-label relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 transition-colors ${
                  active ? "!text-[color:var(--hud-amber)]" : "hover:!text-foreground"
                }`}
              >
                {active && <Lamp color="var(--hud-amber)" />}
                {l.label}
                {active && (
                  <span
                    className="absolute inset-x-3 bottom-0 h-[2px]"
                    style={{ background: "var(--hud-amber)", boxShadow: "0 0 10px var(--hud-amber)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* mobile dropdown */}
      {menuOpen && (
        <div className="border-t bg-background/95 px-4 py-3 sm:hidden" style={{ borderColor: "var(--hud-edge)" }}>
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => {
              const active =
                pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`hud-label flex items-center gap-2 px-3 py-2.5 ${
                    active ? "!text-[color:var(--hud-amber)]" : ""
                  }`}
                  style={
                    active
                      ? {
                          boxShadow: "inset 2px 0 0 var(--hud-amber)",
                          background: "color-mix(in srgb, var(--hud-amber) 7%, transparent)",
                        }
                      : undefined
                  }
                >
                  {active && <Lamp color="var(--hud-amber)" />}
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--hud-edge)" }}>
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
                  className="hud-btn hud-btn-ghost !px-3 !py-2 !text-[0.7rem]"
                  style={tint("var(--muted)")}
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
