"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { addMemo, fetchToken, findAssociatedTokenPda, mplToolbox, transferTokens } from "@metaplex-foundation/mpl-toolbox";
import { AccountNotFoundError, publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint } from "@/lib/chain/connection";
import { ASTRO_CORP_WALLET, CHIMP_MINT, MINING_PERMIT_PRICE_BASE } from "@/lib/chain/mint-config";
import { MINING, miningPermitMemo } from "@/lib/game/sinks";
import { describeTxError } from "@/lib/chain/tx-error";
import { useSession } from "@/components/session-provider";
import { GameShell } from "@/components/games/game-shell";
import { MiningIntro } from "@/components/mining/mining-intro";
import { PriceTicker } from "@/components/mining/price-ticker";
import { usePaidAction } from "@/components/mining/use-paid-action";
import type { MiningStatus } from "@/lib/types";
import Link from "next/link";
import { missionBySlug } from "@/lib/game/config";
import { Lamp, tint } from "@/components/hud";

// The game is a real WebGL (react-three-fiber) scene now - load it client-only
// so the build's static-prerender pass never touches three.js/canvas context
// creation, and the bundle isn't pulled into every other page's chunk.
const MiningGame = dynamic(
  () => import("@/components/games/mining-game").then((m) => m.MiningGame),
  { ssr: false, loading: () => <div className="card h-[280px] animate-pulse" /> },
);

export default function MiningMissionPage() {
  if (missionBySlug("mining")?.comingSoon) return <MiningComingSoon />;
  return <MiningMission />;
}

function MiningComingSoon() {
  return (
    <div className="hud">
      <div className="hud-panel mx-auto mt-10 max-w-lg p-8 text-center" style={tint("var(--accent-violet)")}>
        <div className="hud-label flex items-center justify-center gap-2">
          <Lamp color="var(--hud-amber)" live /> Shaft offline · maintenance
        </div>
        <h1 className="mt-2 text-3xl font-bold uppercase">Deep Core</h1>
        <p className="mt-2 text-sm text-muted">
          The mining shaft is being rebuilt. Deep Core is coming soon - nothing to buy or pay for until it&apos;s back.
        </p>
        <Link href="/dashboard" className="hud-btn mt-6">
          Back to Mission Control ▸
        </Link>
      </div>
    </div>
  );
}

function MiningMission() {
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
      } catch (e) {
        // AccountNotFoundError (no ATA yet) genuinely means zero - anything
        // else is an RPC problem (timeout, rate limit, provider outage) and
        // must not be reported as "you have no $CHIMP", which blocks a real
        // holder from paying and looks identical to a real empty wallet.
        if (e instanceof AccountNotFoundError) {
          throw new Error("This wallet holds no $CHIMP.");
        }
        throw new Error("Couldn't check your $CHIMP balance - the chain RPC may be having trouble. Try again shortly.");
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
