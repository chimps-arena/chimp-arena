"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const player = me?.player ?? null;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-xl">🐵</span>
          <span>CHIMP Arena</span>
        </Link>

        <nav className="ml-4 hidden gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                pathname === l.href || pathname.startsWith(l.href + "/")
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {loading ? null : player ? (
            <>
              <span
                className="mono hidden rounded-md bg-surface-2 px-2 py-1 text-xs text-muted sm:inline"
                title={`Weekly ${TOKEN_SYMBOL} claims begin at token launch`}
              >
                0 {TOKEN_SYMBOL}
              </span>
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold">{player.handle}</div>
                <div className="mono text-xs text-muted">
                  {player.xp.toLocaleString()} XP · {shortWallet(player.wallet)}
                </div>
              </div>
              <button className="btn btn-ghost text-sm" onClick={() => logout()}>
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
