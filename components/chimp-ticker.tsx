"use client";

import { useEffect, useState } from "react";
import { CHIMP_MINT } from "@/lib/chain/mint-config";
import { shortWallet } from "@/lib/format";

interface StatsOk {
  available: true;
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
}
type Stats = StatsOk | { available: false };

function fmtUsd(n: number | null, opts?: Intl.NumberFormatOptions): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 1 ? 6 : 2,
    ...opts,
  });
}

function fmtCompact(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

/**
 * Live $CHIMP market ticker for the homepage hero - mirrors the stat strip
 * on the astrochimpz.com marketing site being replaced (price, market cap,
 * 24h volume, liquidity) plus a copyable contract address, so that real,
 * trust-building data isn't lost in the migration.
 */
export function ChimpTicker() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/chimp-stats")
      .then((r) => r.json())
      .then((d: Stats) => {
        if (active) setStats(d);
      })
      .catch(() => {
        if (active) setStats({ available: false });
      });
    return () => {
      active = false;
    };
  }, []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(CHIMP_MINT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can be unavailable (e.g. insecure context) - not worth surfacing an error for
    }
  }

  const ok = stats?.available ? stats : null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border px-5 py-4"
      style={{
        borderColor: "color-mix(in srgb, var(--border) 70%, transparent)",
        background: "color-mix(in srgb, var(--surface) 55%, transparent)",
        backdropFilter: "blur(14px)",
      }}
    >
      <Stat label="Price" value={ok ? fmtUsd(ok.priceUsd) : "—"} highlight />
      <Stat label="Market Cap" value={ok ? fmtCompact(ok.marketCapUsd) : "—"} />
      <Stat label="24h Volume" value={ok ? fmtCompact(ok.volume24hUsd) : "—"} />
      <Stat label="Liquidity" value={ok ? fmtCompact(ok.liquidityUsd) : "—"} />

      <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={copyAddress}
          className="mono rounded-full border px-3 py-1.5 text-muted transition hover:text-foreground"
          style={{ borderColor: "color-mix(in srgb, var(--border) 80%, transparent)" }}
          title={CHIMP_MINT}
        >
          {copied ? "Copied!" : shortWallet(CHIMP_MINT, 6, 6)}
        </button>
        <a
          href={`https://solscan.io/token/${CHIMP_MINT}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border px-3 py-1.5 text-muted transition hover:text-foreground"
          style={{ borderColor: "color-mix(in srgb, var(--border) 80%, transparent)" }}
        >
          Solscan
        </a>
        <a
          href={`https://raydium.io/swap/?inputMint=So11111111111111111111111111111111111111112&outputMint=${CHIMP_MINT}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full px-4 py-1.5 font-semibold text-background"
          style={{ background: "linear-gradient(135deg, #fff6d8, var(--accent))" }}
        >
          Swap →
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-[5.5rem]">
      <div className="mono text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div
        className="mono text-base font-semibold"
        style={{ color: highlight ? "var(--foreground)" : "var(--muted)" }}
      >
        {value}
      </div>
    </div>
  );
}
