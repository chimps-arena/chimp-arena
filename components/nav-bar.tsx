"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession } from "@/components/session-provider";
import { WalletConnect } from "@/components/wallet-connect";
import { shortWallet } from "@/lib/format";
import { TOKEN_SYMBOL } from "@/lib/game/economy";

const LINKS = [
  { href: "/dashboard", label: "Mission Control" },
  { href: "/leaderboard", label: "Leaderboards" },
  { href: "/crews", label: "Crews" },
];

export function NavBar() {
  const { me, loading, logout } = useSession();
  const { disconnect } = useWallet();
  const pathname = usePathname();
  const player = me?.player ?? null;

  async function fullDisconnect() {
    await logout();
    try {
      await disconnect();
    } catch {
      /* wallet already disconnected */
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          <span className="text-xl">🐵</span>
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
              <span
                className="chip mono hidden text-accent sm:inline-flex"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--accent) 40%, transparent)",
                }}
                title={`Weekly ${TOKEN_SYMBOL} claims begin at token launch`}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                0 {TOKEN_SYMBOL}
              </span>
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
