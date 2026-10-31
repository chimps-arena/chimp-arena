"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { fetchToken, findAssociatedTokenPda, mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { AccountNotFoundError, publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint, explorerAddress, explorerTx } from "@/lib/chain/connection";
import { SOLANA_CLUSTER } from "@/lib/chain/connection";
import { CHIMP_MINT, CHIMP_DECIMALS } from "@/lib/chain/mint-config";
import { describeTxError, type DescribedTxError } from "@/lib/chain/tx-error";
import { decodeTransaction, newAssetKeypair, walletSignsFirst } from "@/lib/chain/wallet-signs-first";
import { TxErrorBanner } from "@/components/tx-error-banner";
import { useTxTracker } from "@/components/tx-tracker";
import { SALES_UNAVAILABLE_MESSAGE, useSalesAvailability } from "@/components/use-sales-availability";
import type { LandProperty } from "@/lib/types";

type Phase = "idle" | "confirm" | "buying" | "done" | "error" | "stuck";

export function LandMarket() {
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const [properties, setProperties] = useState<LandProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState<string>("all");

  useEffect(() => {
    let active = true;
    fetch("/api/land")
      .then((r) => r.json())
      .then((d) => {
        if (active) setProperties(d.properties ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const zones = useMemo(
    () => Array.from(new Set(properties.map((p) => p.zone))),
    [properties],
  );
  const visible = zone === "all" ? properties : properties.filter((p) => p.zone === zone);

  const { track } = useTxTracker();
  const [selected, setSelected] = useState<LandProperty | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const salesAvailable = useSalesAvailability();
  const [error, setError] = useState<DescribedTxError | null>(null);
  const [result, setResult] = useState<{ asset: string; signature: string; warning?: string } | null>(null);
  const [stuckPayment, setStuckPayment] = useState<{ signature: string } | null>(null);

  const walletKey = wallet.publicKey?.toBase58() ?? null;
  const umi = useMemo(() => {
    const u = createUmi(chainEndpoint()).use(mplToolbox());
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  function open(p: LandProperty) {
    setSelected(p);
    setPhase("confirm");
    setError(null);
    setResult(null);
  }

  /** Shared by a fresh purchase and by retrying a stuck one without paying
   *  again - see components/chimp-mint.tsx's identical split for why. By
   *  now the property NFT is already in the buyer's wallet; this is our
   *  bookkeeping plus the collection move (app/api/land/confirm). */
  async function confirmWithSignature(owner: string, signature: string) {
    if (!selected) return;
    const confirmRes = await fetch("/api/land/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyId: selected.id, wallet: owner, signature }),
    });
    const confirmed = await confirmRes.json().catch(() => ({}));
    if (!confirmRes.ok) {
      setStuckPayment({ signature });
      setPhase("stuck");
      return;
    }
    finish(confirmed);
  }

  function finish(done: { asset: string; signature: string; warning?: string }) {
    if (!selected) return;
    setStuckPayment(null);
    setResult({ asset: done.asset, signature: done.signature, warning: done.warning });
    setPhase("done");
    setProperties((prev) => prev.filter((p) => p.id !== selected.id));
  }

  async function buy() {
    if (!selected || !wallet.publicKey) return;
    setPhase("buying");
    setError(null);
    const owner = wallet.publicKey.toBase58();

    let signature: string;
    try {
      const buyerAta = findAssociatedTokenPda(umi, { mint: publicKey(CHIMP_MINT), owner: publicKey(owner) });
      const priceBase = BigInt(selected.priceChimp) * 10n ** BigInt(CHIMP_DECIMALS);

      let held: bigint;
      try {
        held = (await fetchToken(umi, buyerAta)).amount;
      } catch (e) {
        if (e instanceof AccountNotFoundError) {
          throw new Error("This wallet holds no $CHIMP.");
        }
        throw new Error("Couldn't check your $CHIMP balance - the chain RPC may be having trouble. Try again shortly.");
      }
      if (held < priceBase) {
        throw new Error(
          `Need ${selected.priceChimp.toLocaleString()} $CHIMP. This wallet has ${(
            Number(held) /
            10 ** CHIMP_DECIMALS
          ).toLocaleString()}.`,
        );
      }

      // The server builds ONE transaction with the $CHIMP payment and the
      // property NFT's creation, this wallet as the only signer and fee
      // payer - the buyer covers the NFT's own SOL rent (see
      // app/api/land/prepare). Refused up front (nothing charged) if sales
      // are temporarily unavailable or someone else is mid-purchase.
      // The new NFT's address keypair never leaves the browser - see
      // components/chimp-mint.tsx and lib/chain/wallet-signs-first.ts.
      const assetKeypair = newAssetKeypair();
      const prepRes = await fetch("/api/land/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId: selected.id, wallet: owner, asset: assetKeypair.publicKey.toBase58() }),
      });
      const prepared = await prepRes.json().catch(() => ({}));
      if (!prepRes.ok) {
        throw new Error(prepared.error || "Could not prepare the purchase - try again.");
      }
      if (prepared.completed) {
        // An earlier attempt from this wallet had already paid and landed.
        finish(prepared);
        return;
      }

      const connection = new Connection(chainEndpoint(), "confirmed");
      signature = await walletSignsFirst(wallet, connection, decodeTransaction(prepared.transaction), assetKeypair);
      track(signature, "Property purchase");
      await connection.confirmTransaction(
        { signature, blockhash: prepared.blockhash, lastValidBlockHeight: prepared.lastValidBlockHeight },
        "confirmed",
      );
    } catch (e) {
      setError(describeTxError(e));
      setPhase("error");
      return;
    }

    await confirmWithSignature(owner, signature);
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6">
      {!wallet.publicKey && (
        <div className="hud-panel p-6 text-center">
          <p className="text-sm text-muted">Connect a wallet holding $CHIMP to buy land.</p>
          <div className="mt-4 flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      )}
      {SOLANA_CLUSTER !== "mainnet-beta" && (
        <p className="border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          App is not on mainnet (`NEXT_PUBLIC_SOLANA_CLUSTER`).
        </p>
      )}

      {zones.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`hud-tag cursor-pointer ${zone === "all" ? "text-accent-2" : "text-muted"}`}
            onClick={() => setZone("all")}
          >
            All zones
          </button>
          {zones.map((z) => (
            <button
              key={z}
              className={`hud-tag cursor-pointer ${zone === z ? "text-accent-2" : "text-muted"}`}
              onClick={() => setZone(z)}
            >
              {z}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="hud-panel h-56 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="hud-panel p-6 text-sm text-muted">
          No land available to buy right now. Check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <button key={p.id} className="hud-panel overflow-hidden text-left" onClick={() => open(p)}>
              {p.imageUrl && (
                <div className="relative aspect-[4/3] w-full">
                  <Image src={p.imageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold uppercase">{p.name}</h3>
                <div className="mono text-xs text-muted">{p.zone} · {p.type}</div>
                {p.blurb && <p className="mt-2 text-sm text-muted">{p.blurb}</p>}
                <div className="hud-value mt-3 text-[color:var(--hud-amber)]">
                  {p.priceChimp.toLocaleString()} $CHIMP
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="hud-panel w-full max-w-md p-6">
            {phase === "confirm" && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="text-sm text-muted">
                  {selected.priceChimp.toLocaleString()} $CHIMP, one transaction, straight to
                  Astro Corp. This can&apos;t be undone. You&apos;ll also need a
                  small amount of SOL (a few thousandths) for the network fee and
                  the NFT&apos;s on-chain storage rent.
                </p>
                {salesAvailable === false && (
                  <p className="border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
                    {SALES_UNAVAILABLE_MESSAGE}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    className="hud-btn flex-1"
                    disabled={salesAvailable === false}
                    onClick={() => void buy()}
                  >
                    {salesAvailable === false ? "Temporarily unavailable" : "Confirm & sign"}
                  </button>
                  <button className="hud-btn hud-btn-ghost" onClick={() => setSelected(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {phase === "buying" && (
              <button className="hud-btn w-full" disabled>
                {stuckPayment ? "Retrying…" : "Buying… approve in your wallet"}
              </button>
            )}
            {phase === "error" && error && (
              <div className="flex flex-col gap-3">
                <TxErrorBanner error={error} />
                <button className="hud-btn hud-btn-ghost" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
            )}
            {phase === "stuck" && stuckPayment && (
              <div className="flex flex-col gap-3">
                <div className="border border-bad/40 bg-bad/10 p-3 text-sm">
                  <div className="font-semibold text-bad">
                    Your property NFT is yours - we just need to record it
                  </div>
                  <p className="mt-0.5 text-muted">
                    The transaction already landed, so the NFT is in your
                    wallet right now - this is only our bookkeeping catching
                    up. Retry below, nothing will be charged again.
                  </p>
                  <a
                    href={explorerTx(stuckPayment.signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="mono mt-2 inline-block text-xs underline"
                  >
                    transaction ↗
                  </a>
                </div>
                <button
                  className="hud-btn"
                  onClick={async () => {
                    if (!wallet.publicKey) return;
                    setPhase("buying");
                    await confirmWithSignature(wallet.publicKey.toBase58(), stuckPayment.signature);
                  }}
                >
                  Retry (no extra payment)
                </button>
              </div>
            )}
            {phase === "done" && result && (
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-good">Sold. Welcome to {selected.name}.</p>
                {result.warning && (
                  <p className="border border-bad/40 bg-bad/10 p-2 text-xs text-bad">
                    {result.warning}
                  </p>
                )}
                <a
                  href={explorerAddress(result.asset)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono text-xs underline"
                >
                  NFT: {result.asset.slice(0, 8)}…{result.asset.slice(-8)}
                </a>
                <a
                  href={explorerTx(result.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono text-xs underline"
                >
                  transaction ↗
                </a>
                <button
                  className="hud-btn hud-btn-ghost mt-2"
                  onClick={() => {
                    setSelected(null);
                    setPhase("idle");
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
