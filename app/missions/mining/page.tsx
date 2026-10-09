"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { addMemo, fetchToken, findAssociatedTokenPda, mplToolbox, transferTokens } from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint } from "@/lib/chain/connection";
import { ASTRO_CORP_WALLET, CHIMP_MINT, MINING_PERMIT_PRICE_BASE } from "@/lib/chain/mint-config";
import { MINING, miningPermitMemo } from "@/lib/game/sinks";
import { describeTxError } from "@/lib/chain/tx-error";
import { useSession } from "@/components/session-provider";
import { GameShell } from "@/components/games/game-shell";
import { MiningGame } from "@/components/games/mining-game";
import { MiningIntro } from "@/components/mining/mining-intro";
import { PriceTicker } from "@/components/mining/price-ticker";
import { usePaidAction } from "@/components/mining/use-paid-action";
import type { MiningStatus } from "@/lib/types";

export default function MiningMissionPage() {
  const wallet = useWallet();
  const { me } = useSession();
  const { pay, stuckSignature, setStuckSignature } = usePaidAction("chimp:stuck:mining-permit");
  const [status, setStatus] = useState<MiningStatus | null>(null);

  const walletKey = wallet.publicKey?.toBase58() ?? null;
  const umi = useMemo(() => {
    const u = createUmi(chainEndpoint()).use(mplToolbox());
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/mining");
    const data = (await res.json()) as MiningStatus;
    setStatus(data);
    return data;
  }, []);

  useEffect(() => {
    // loadStatus() awaits the fetch before setState, so this is not a synchronous update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus();
  }, [loadStatus]);

  /** Passed to GameShell as prepareStart - runs right before /start. Buys a
   *  permit only if none is already paid-for/resumable. */
  const ensurePermit = useCallback(async () => {
    const s = await loadStatus();
    if (!s.realWallet) {
      throw new Error("Mining needs a real wallet, not a guest session.");
    }
    if (s.permits.resumable || s.permits.unstarted > 0) return;

    if (!wallet.publicKey) {
      throw new Error(
        "Being logged in to the site isn't enough - connect your wallet above to pay for a permit.",
      );
    }
    if (!me?.player || wallet.publicKey.toBase58() !== me.player.wallet) {
      throw new Error("Connect the same wallet you're logged in with before paying.");
    }

    const owner = publicKey(wallet.publicKey.toBase58());
    const mint = publicKey(CHIMP_MINT);
    const buyerAta = findAssociatedTokenPda(umi, { mint, owner });
    const astroAta = findAssociatedTokenPda(umi, { mint, owner: publicKey(ASTRO_CORP_WALLET) });

    let signature = stuckSignature;
    if (!signature) {
      let held: bigint;
      try {
        held = (await fetchToken(umi, buyerAta)).amount;
      } catch {
        throw new Error("This wallet holds no $CHIMP.");
      }
      if (held < MINING_PERMIT_PRICE_BASE) {
        throw new Error(`Need ${MINING.permitPriceChimp} $CHIMP for a permit.`);
      }

      try {
        signature = await pay(
          umi,
          transferTokens(umi, {
            source: buyerAta,
            destination: astroAta,
            authority: umi.identity,
            amount: MINING_PERMIT_PRICE_BASE,
          }).add(addMemo(umi, { memo: miningPermitMemo(owner) })),
          "Mining permit",
        );
      } catch (e) {
        throw new Error(describeTxError(e).detail);
      }
    }

    const res = await fetch("/api/mining/permit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signature }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.error ?? "Could not record the permit payment - your $CHIMP is safe, try again.",
      );
    }
    setStuckSignature(null);
    await loadStatus();
  }, [wallet.publicKey, me, umi, stuckSignature, pay, setStuckSignature, loadStatus]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex max-w-2xl flex-1 flex-col gap-6">
        <MiningIntro
          status={status}
          onChange={() => {
            void loadStatus();
          }}
        />
        <GameShell
          slug="mining"
          title="Deep Core"
          subtitle="Buy a permit, dig through the strata. Deeper seams, rarer ore."
          startLabel="Drop the rig"
          instructions={
            <ul className="list-disc space-y-1 pl-5">
              <li>Costs {MINING.permitPriceChimp} $CHIMP per permit - paid once, used for one run.</li>
              <li>Move into rock to dig it - better tools dig faster through harder depths.</li>
              <li>Blue ore is worth digging toward; red gas costs oxygen, green air restores it.</li>
              <li>Depth reached is your score. The run ends when oxygen runs out.</li>
            </ul>
          }
          prepareStart={ensurePermit}
          renderGame={(ctx) => <MiningGame {...ctx} />}
        />
      </div>
      <div className="w-full lg:sticky lg:top-6 lg:w-64 lg:shrink-0">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Vein exchange
        </div>
        <PriceTicker compact />
      </div>
    </div>
  );
}
