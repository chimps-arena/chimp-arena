"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  addMemo,
  fetchToken,
  findAssociatedTokenPda,
  mplToolbox,
  transferTokens,
} from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint, explorerAddress, explorerTx } from "@/lib/chain/connection";
import { SOLANA_CLUSTER } from "@/lib/chain/connection";
import { ASTRO_CORP_WALLET, CHIMP_MINT, CHIMP_DECIMALS } from "@/lib/chain/mint-config";
import { propertyMintMemo } from "@/lib/chain/property-mint-config";
import type { LandProperty } from "@/lib/types";

type Phase = "idle" | "confirm" | "buying" | "done" | "error";

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

  const [selected, setSelected] = useState<LandProperty | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ asset: string; signature: string } | null>(null);

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

  async function buy() {
    if (!selected || !wallet.publicKey) return;
    setPhase("buying");
    setError(null);
    try {
      const owner = publicKey(wallet.publicKey.toBase58());
      const mint = publicKey(CHIMP_MINT);
      const buyerAta = findAssociatedTokenPda(umi, { mint, owner });
      const astroAta = findAssociatedTokenPda(umi, { mint, owner: publicKey(ASTRO_CORP_WALLET) });
      const priceBase = BigInt(selected.priceChimp) * 10n ** BigInt(CHIMP_DECIMALS);

      let held: bigint;
      try {
        held = (await fetchToken(umi, buyerAta)).amount;
      } catch {
        throw new Error("This wallet holds no $CHIMP.");
      }
      if (held < priceBase) {
        throw new Error(
          `Need ${selected.priceChimp.toLocaleString()} $CHIMP — this wallet has ${(
            Number(held) /
            10 ** CHIMP_DECIMALS
          ).toLocaleString()}.`,
        );
      }

      const tx = await transferTokens(umi, {
        source: buyerAta,
        destination: astroAta,
        authority: umi.identity,
        amount: priceBase,
      })
        .add(addMemo(umi, { memo: propertyMintMemo(selected.id, owner) }))
        .sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

      const paymentSignature = bs58.encode(tx.signature);

      const claimRes = await fetch("/api/land/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId: selected.id, wallet: owner, signature: paymentSignature }),
      });
      const claim = await claimRes.json().catch(() => ({}));
      if (!claimRes.ok) {
        throw new Error(
          `Payment went through but minting failed (${claim.error || "unknown error"}) - contact support with this transaction: ${paymentSignature}`,
        );
      }

      setResult({ asset: claim.asset, signature: claim.signature });
      setPhase("done");
      setProperties((prev) => prev.filter((p) => p.id !== selected.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
      setPhase("error");
    }
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6">
      {!wallet.publicKey && (
        <div className="card p-6 text-center">
          <p className="text-sm text-muted">Connect a wallet holding $CHIMP to buy land.</p>
          <div className="mt-4 flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      )}
      {SOLANA_CLUSTER !== "mainnet-beta" && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          App is not on mainnet (`NEXT_PUBLIC_SOLANA_CLUSTER`).
        </p>
      )}

      {zones.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`chip ${zone === "all" ? "text-accent-2" : "text-muted"}`}
            onClick={() => setZone("all")}
          >
            All zones
          </button>
          {zones.map((z) => (
            <button
              key={z}
              className={`chip ${zone === z ? "text-accent-2" : "text-muted"}`}
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
            <div key={i} className="card h-56 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="card p-6 text-sm text-muted">
          No land available to buy right now — check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <button key={p.id} className="card overflow-hidden text-left" onClick={() => open(p)}>
              {p.imageUrl && (
                <div className="relative h-36 w-full">
                  <Image src={p.imageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="p-4">
                <div className="font-semibold">{p.name}</div>
                <div className="mono text-xs text-muted">{p.zone} · {p.type}</div>
                {p.blurb && <p className="mt-2 text-sm text-muted">{p.blurb}</p>}
                <div className="mt-3 font-semibold text-accent">
                  {p.priceChimp.toLocaleString()} $CHIMP
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6">
            {phase === "confirm" && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="text-sm text-muted">
                  {selected.priceChimp.toLocaleString()} $CHIMP, one transaction, straight to
                  Astro Corp. This can&apos;t be undone.
                </p>
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1" onClick={() => void buy()}>
                    Confirm &amp; sign
                  </button>
                  <button className="btn btn-ghost" onClick={() => setSelected(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {phase === "buying" && (
              <button className="btn btn-primary w-full" disabled>
                Buying… approve in your wallet
              </button>
            )}
            {phase === "error" && (
              <div className="flex flex-col gap-3">
                <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
                  {error}
                </p>
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
            )}
            {phase === "done" && result && (
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-good">Sold. Welcome to {selected.name}.</p>
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
                  className="btn btn-ghost mt-2"
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
