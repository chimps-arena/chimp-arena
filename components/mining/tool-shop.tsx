"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { addMemo, findAssociatedTokenPda, mplToolbox, transferTokens } from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint } from "@/lib/chain/connection";
import { ASTRO_CORP_WALLET, CHIMP_MINT } from "@/lib/chain/mint-config";
import { toolMemo } from "@/lib/game/sinks";
import { TOOLS } from "@/lib/game/mining";
import { usePaidAction } from "@/components/mining/use-paid-action";
import { describeTxError } from "@/lib/chain/tx-error";
import { TxErrorBanner } from "@/components/tx-error-banner";
import { useSession } from "@/components/session-provider";

interface Quote {
  tier: 1 | 2;
  requires: { gold: number; cobalt: number; palladium: number; crystal: number };
  chimpCostBase: string;
  chimpCost: number;
}

export function ToolShop({
  currentTier,
  onUpgraded,
}: {
  currentTier: number;
  onUpgraded: () => void | Promise<void>;
}) {
  const wallet = useWallet();
  const { me, refresh } = useSession();
  const { pay, error, setError, stuckSignature, setStuckSignature } = usePaidAction(
    "chimp:stuck:mining-tool",
  );
  const [busyTier, setBusyTier] = useState<number | null>(null);
  const [quotes, setQuotes] = useState<Record<1 | 2, Quote | null>>({ 1: null, 2: null });

  const walletKey = wallet.publicKey?.toBase58() ?? null;
  const umi = useMemo(() => {
    const u = createUmi(chainEndpoint()).use(mplToolbox());
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  const nextTier = (currentTier + 1) as 1 | 2;

  const loadQuote = async (tier: 1 | 2) => {
    const res = await fetch(`/api/mining/quote?tier=${tier}`);
    if (!res.ok) return;
    const data = (await res.json()) as Quote;
    setQuotes((prev) => ({ ...prev, [tier]: data }));
  };

  useEffect(() => {
    // loadQuote() awaits the fetch before setState, so this is not a synchronous update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQuote(nextTier);
  }, [nextTier]);

  async function upgrade(tier: 1 | 2) {
    const quote = quotes[tier];
    if (!wallet.publicKey || !me?.player || !quote) return;
    if (wallet.publicKey.toBase58() !== me.player.wallet) {
      setError({
        category: "unknown",
        title: "Wrong wallet",
        detail: "Connect the same wallet you're logged in with before paying.",
        retryable: true,
      });
      return;
    }
    if (me.player.gold < quote.requires.gold) {
      setError({
        category: "insufficient-token",
        title: "Not enough Gold",
        detail: `Need ${quote.requires.gold} Gold for this tool.`,
        retryable: false,
      });
      return;
    }

    setBusyTier(tier);
    setError(null);
    try {
      const owner = publicKey(wallet.publicKey.toBase58());
      const mint = publicKey(CHIMP_MINT);
      const buyerAta = findAssociatedTokenPda(umi, { mint, owner });
      const astroAta = findAssociatedTokenPda(umi, { mint, owner: publicKey(ASTRO_CORP_WALLET) });
      const amount = BigInt(quote.chimpCostBase);

      const signature =
        stuckSignature ??
        (await pay(
          umi,
          transferTokens(umi, {
            source: buyerAta,
            destination: astroAta,
            authority: umi.identity,
            amount,
          }).add(addMemo(umi, { memo: toolMemo(owner, tier) })),
          `Tool upgrade (tier ${tier})`,
        ));

      const res = await fetch("/api/mining/tool", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upgrade failed");
      setStuckSignature(null);
      await Promise.all([onUpgraded(), refresh(), loadQuote(nextTier)]);
    } catch (e) {
      setError(describeTxError(e));
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-semibold">
        Tool upgrades
        <span className="ml-2 text-xs font-normal text-muted">
          Resource cost is priced live from the market - buying one is what creates demand.
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {TOOLS.map((t) => {
          const owned = t.tier === currentTier;
          const next = t.tier === nextTier;
          const quote = t.tier === 1 || t.tier === 2 ? quotes[t.tier as 1 | 2] : null;
          return (
            <div
              key={t.tier}
              className="rounded-xl border p-3"
              style={{
                borderColor: owned
                  ? "color-mix(in srgb, var(--accent) 55%, transparent)"
                  : "color-mix(in srgb, var(--border) 70%, transparent)",
              }}
            >
              <div className="font-semibold">{t.name}</div>
              <p className="text-xs text-muted">
                Dig {t.digPower}x · Yield {t.yieldMult}x
              </p>
              {owned ? (
                <p className="mt-2 text-xs text-accent">Equipped</p>
              ) : next && quote ? (
                <>
                  <p className="mt-2 text-xs text-muted">
                    {[
                      quote.requires.gold ? `${quote.requires.gold} gold` : null,
                      quote.requires.cobalt ? `${quote.requires.cobalt} cobalt` : null,
                      quote.requires.palladium ? `${quote.requires.palladium} palladium` : null,
                      quote.requires.crystal ? `${quote.requires.crystal} crystal` : null,
                    ]
                      .filter(Boolean)
                      .join(" + ")}
                  </p>
                  <button
                    className="btn btn-ghost mt-1 w-full text-xs disabled:opacity-40"
                    disabled={busyTier !== null}
                    onClick={() => upgrade(t.tier as 1 | 2)}
                  >
                    {busyTier === t.tier
                      ? "Upgrading…"
                      : `~${quote.chimpCost.toLocaleString(undefined, { maximumFractionDigits: 1 })} $CHIMP`}
                  </button>
                </>
              ) : next ? (
                <p className="mt-2 text-xs text-muted">Pricing…</p>
              ) : (
                <p className="mt-2 text-xs text-muted">Locked</p>
              )}
            </div>
          );
        })}
      </div>
      {error && <TxErrorBanner error={error} />}
    </div>
  );
}
