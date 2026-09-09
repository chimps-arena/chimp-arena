"use client";

import { useMemo, useState } from "react";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { create as createCoreAsset } from "@metaplex-foundation/mpl-core";
import {
  fetchToken,
  findAssociatedTokenPda,
  mplToolbox,
  transferTokens,
} from "@metaplex-foundation/mpl-toolbox";
import { generateSigner, publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint, explorerAddress, explorerTx } from "@/lib/chain/connection";
import { SOLANA_CLUSTER } from "@/lib/chain/connection";
import {
  ASTRO_CORP_WALLET,
  CHIMP_MINT,
  CHIMP_DECIMALS,
  MINT_PRICE_BASE,
  MINT_PRICE_CHIMP,
} from "@/lib/chain/mint-config";

type Phase = "idle" | "confirm" | "minting" | "done" | "error";

interface Result {
  asset: string;
  signature: string;
}

export function ChimpMint() {
  const wallet = useWallet();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const walletKey = wallet.publicKey?.toBase58() ?? null;
  const umi = useMemo(() => {
    const u = createUmi(chainEndpoint()).use(mplToolbox());
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      u.use(walletAdapterIdentity(wallet));
    }
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  const connected = !!wallet.publicKey;
  const onMainnet = SOLANA_CLUSTER === "mainnet-beta";

  async function checkBalance() {
    if (!wallet.publicKey) return;
    try {
      const ata = findAssociatedTokenPda(umi, {
        mint: publicKey(CHIMP_MINT),
        owner: publicKey(wallet.publicKey.toBase58()),
      });
      const tok = await fetchToken(umi, ata);
      setBalance(Number(tok.amount) / 10 ** CHIMP_DECIMALS);
    } catch {
      setBalance(0);
    }
  }

  async function mint() {
    if (!wallet.publicKey) return;
    setPhase("minting");
    setError(null);
    try {
      const owner = publicKey(wallet.publicKey.toBase58());
      const mint = publicKey(CHIMP_MINT);
      const buyerAta = findAssociatedTokenPda(umi, { mint, owner });
      const astroAta = findAssociatedTokenPda(umi, {
        mint,
        owner: publicKey(ASTRO_CORP_WALLET),
      });

      // Preflight: enough $CHIMP?
      let held: bigint;
      try {
        held = (await fetchToken(umi, buyerAta)).amount;
      } catch {
        throw new Error("This wallet holds no $CHIMP.");
      }
      if (held < MINT_PRICE_BASE) {
        throw new Error(
          `Need ${MINT_PRICE_CHIMP.toLocaleString()} $CHIMP — this wallet has ${(
            Number(held) /
            10 ** CHIMP_DECIMALS
          ).toLocaleString()}.`,
        );
      }

      const asset = generateSigner(umi);

      // ONE transaction: pay Astro Corp + mint the NFT. Atomic.
      const tx = await transferTokens(umi, {
        source: buyerAta,
        destination: astroAta,
        authority: umi.identity,
        amount: MINT_PRICE_BASE,
      })
        .add(
          createCoreAsset(umi, {
            asset,
            name: "Astrochimp",
            uri: `${window.location.origin}/nft/metadata`,
          }),
        )
        .sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

      setResult({
        asset: asset.publicKey.toString(),
        signature: bs58.encode(tx.signature),
      });
      setPhase("done");
      void checkBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mint failed");
      setPhase("error");
    }
  }

  if (!connected) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">Connect the wallet holding your $CHIMP.</p>
        <div className="mt-4 flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      {!onMainnet && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          App is not on mainnet (`NEXT_PUBLIC_SOLANA_CLUSTER`). This mint moves
          real $CHIMP and needs mainnet.
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Your $CHIMP</span>
        <button className="btn btn-ghost text-xs" onClick={checkBalance}>
          {balance == null ? "check balance" : balance.toLocaleString()}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Price</span>
          <span className="font-semibold">
            {MINT_PRICE_CHIMP.toLocaleString()} $CHIMP
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Goes to</span>
          <a
            href={explorerAddress(ASTRO_CORP_WALLET)}
            target="_blank"
            rel="noreferrer"
            className="mono text-xs underline"
          >
            Astro Corp
          </a>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">You receive</span>
          <span className="font-semibold">1 Astrochimp NFT</span>
        </div>
      </div>

      {phase === "idle" && (
        <button className="btn btn-primary" onClick={() => setPhase("confirm")}>
          Mint an Astrochimp
        </button>
      )}

      {phase === "confirm" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            <strong className="text-foreground">Mainnet — real tokens.</strong>{" "}
            You will send {MINT_PRICE_CHIMP.toLocaleString()} $CHIMP to Astro Corp
            and receive one Astrochimp NFT, in a single transaction. This can’t be
            undone.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={mint}>
              Confirm &amp; sign
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setPhase("idle")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "minting" && (
        <button className="btn btn-primary" disabled>
          Minting… approve in your wallet
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

      {phase === "done" && result && (
        <div className="flex flex-col gap-2 rounded-xl border border-good/40 bg-good/10 p-4 text-sm">
          <p className="font-semibold text-good">Minted.</p>
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
              setResult(null);
              setPhase("idle");
            }}
          >
            Mint another
          </button>
        </div>
      )}
    </div>
  );
}
