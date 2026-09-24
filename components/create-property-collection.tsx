"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { createCollection } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint, explorerAddress } from "@/lib/chain/connection";
import { SOLANA_CLUSTER } from "@/lib/chain/connection";
import {
  ASTRO_CORP_WALLET,
  PROPERTIES_COLLECTION,
  PROPERTY_COLLECTION_NAME,
  PROPERTY_ROYALTY_BASIS_POINTS,
} from "@/lib/chain/property-mint-config";

type Phase = "idle" | "confirm" | "creating" | "done" | "error";

/**
 * One-time setup for the Astrochimps Properties collection - identical
 * pattern to components/create-collection.tsx (Astrochimps). Any funded
 * wallet can pay for/sign this; updateAuthority is set explicitly to Astro
 * Corp regardless of who signs, same reasoning as the NFT collection.
 *
 * Run this once, then put the resulting address in
 * NEXT_PUBLIC_PROPERTIES_COLLECTION (local + Vercel) so property mints join it.
 */
export function CreatePropertyCollection() {
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const walletKey = wallet.publicKey?.toBase58() ?? null;
  const umi = useMemo(() => {
    const u = createUmi(chainEndpoint());
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  const isAstroCorpWallet = walletKey === ASTRO_CORP_WALLET;

  async function create() {
    setPhase("creating");
    setError(null);
    try {
      const collection = generateSigner(umi);
      await createCollection(umi, {
        collection,
        name: PROPERTY_COLLECTION_NAME,
        uri: `${window.location.origin}/nft/property-collection-metadata`,
        updateAuthority: publicKey(ASTRO_CORP_WALLET),
        plugins: [
          {
            type: "Royalties",
            basisPoints: PROPERTY_ROYALTY_BASIS_POINTS,
            creators: [{ address: publicKey(ASTRO_CORP_WALLET), percentage: 100 }],
            ruleSet: { type: "None" },
          },
        ],
      }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

      setAddress(collection.publicKey.toString());
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the collection");
      setPhase("error");
    }
  }

  if (!mounted) return <div className="card h-40 animate-pulse p-6" />;

  if (PROPERTIES_COLLECTION) {
    return (
      <div className="card p-6">
        <p className="text-sm text-muted">
          Already created:{" "}
          <a
            href={explorerAddress(PROPERTIES_COLLECTION)}
            target="_blank"
            rel="noreferrer"
            className="mono underline"
          >
            {PROPERTIES_COLLECTION}
          </a>
        </p>
      </div>
    );
  }

  if (!wallet.publicKey) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">
          Connect any funded wallet to pay for this one-time setup — it
          doesn&apos;t need to be the Astro Corp wallet. Control still lands
          on Astro Corp either way (see below).
        </p>
        <div className="mt-4 flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      {!isAstroCorpWallet && (
        <p className="rounded-lg border border-accent-2/40 bg-accent-2/10 p-3 text-sm text-muted">
          <strong className="text-foreground">
            {walletKey?.slice(0, 4)}…{walletKey?.slice(-4)}
          </strong>{" "}
          will pay for this transaction. That&apos;s fine — the collection&apos;s
          update authority is set below regardless of who signs.
        </p>
      )}
      {SOLANA_CLUSTER !== "mainnet-beta" && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          Not on mainnet — this collection would be created on{" "}
          {SOLANA_CLUSTER}.
        </p>
      )}

      <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Name</span>
          <span className="font-semibold">{PROPERTY_COLLECTION_NAME}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Royalty</span>
          <span className="font-semibold">{PROPERTY_ROYALTY_BASIS_POINTS / 100}%</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Update authority</span>
          <span className="mono text-xs">
            {ASTRO_CORP_WALLET.slice(0, 4)}…{ASTRO_CORP_WALLET.slice(-4)}
          </span>
        </div>
      </div>

      {phase === "idle" && (
        <button className="btn btn-primary" onClick={() => setPhase("confirm")}>
          Create the collection
        </button>
      )}

      {phase === "confirm" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            This is a <strong className="text-foreground">one-time, irreversible</strong>{" "}
            setup transaction on mainnet. Costs a small amount of SOL (rent).
          </p>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => void create()}>
              Confirm &amp; sign
            </button>
            <button className="btn btn-ghost" onClick={() => setPhase("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "creating" && (
        <button className="btn btn-primary" disabled>
          Creating… approve in your wallet
        </button>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-3">
          <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            {error}
          </p>
          <button className="btn btn-ghost" onClick={() => setPhase("idle")}>
            Try again
          </button>
        </div>
      )}

      {phase === "done" && address && (
        <div className="flex flex-col gap-2 rounded-xl border border-good/40 bg-good/10 p-4 text-sm">
          <p className="font-semibold text-good">Created.</p>
          <a
            href={explorerAddress(address)}
            target="_blank"
            rel="noreferrer"
            className="mono text-xs underline"
          >
            {address}
          </a>
          <p className="mt-2 text-xs text-muted">
            Add this as <code>NEXT_PUBLIC_PROPERTIES_COLLECTION</code> in
            .env.local and on Vercel, then redeploy — new property mints will
            join this collection and carry the royalty.
          </p>
        </div>
      )}
    </div>
  );
}
