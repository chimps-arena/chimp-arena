"use client";

import { useEffect, useMemo, useState } from "react";
import { Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
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
import { describeTxError, type DescribedTxError } from "@/lib/chain/tx-error";
import { TxErrorBanner } from "@/components/tx-error-banner";
import { useTxTracker } from "@/components/tx-tracker";
import {
  ASTRO_CORP_WALLET,
  CHIMP_MINT,
  CHIMP_DECIMALS,
  MILESTONE_MINT_INTERVAL,
  MINT_PRICE_BASE,
  MINT_PRICE_CHIMP,
  mintMemo,
} from "@/lib/chain/mint-config";

type Phase = "idle" | "confirm" | "minting" | "done" | "error" | "stuck";

interface Milestone {
  mintNumber: number;
  asset: string;
  name: string;
}

interface Result {
  asset: string;
  signature: string;
  tier?: string;
  name?: string;
  milestone?: Milestone;
}

const TIER_LABEL: Record<string, string> = {
  standard: "Standard",
  rare: "Rare",
  one_of_one: "One of One",
};
const TIER_STYLE: Record<string, string> = {
  standard: "text-foreground",
  rare: "text-accent-3",
  one_of_one: "text-accent",
};

export function ChimpMint() {
  const wallet = useWallet();
  const { track } = useTxTracker();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<DescribedTxError | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  /** Set once a payment lands but the mint itself fails - lets "try again"
   *  resubmit this same payment to the claim route instead of paying twice. */
  const [stuckPayment, setStuckPayment] = useState<{ signature: string; raw: string } | null>(null);

  // Wallet UI only renders post-hydration: WalletMultiButton renders
  // different markup on server vs client and would trip a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

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

  /** Submits the payment signature to the claim route - shared by a fresh
   *  mint and by retrying a stuck one without paying again. */
  async function claimWithSignature(owner: string, paymentSignature: string) {
    const claimRes = await fetch("/api/mint/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: owner, signature: paymentSignature }),
    });
    const claim = await claimRes.json().catch(() => ({}));
    if (!claimRes.ok) {
      // This failure happens on OUR side (the mint delegate), after the
      // buyer's money already moved - never describeTxError() this as if
      // it were the buyer's wallet. See lib/chain/tx-error.ts.
      setStuckPayment({ signature: paymentSignature, raw: claim.error || "unknown error" });
      setPhase("stuck");
      return;
    }
    setStuckPayment(null);
    setResult({
      asset: claim.asset,
      signature: claim.signature,
      tier: claim.tier,
      name: claim.name,
      milestone: claim.milestone,
    });
    setPhase("done");
    void checkBalance();
  }

  async function mint() {
    if (!wallet.publicKey) return;
    setPhase("minting");
    setError(null);
    const owner = publicKey(wallet.publicKey.toBase58());

    let paymentSignature: string;
    try {
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
          `Need ${MINT_PRICE_CHIMP.toLocaleString()} $CHIMP. This wallet has ${(
            Number(held) /
            10 ** CHIMP_DECIMALS
          ).toLocaleString()}.`,
        );
      }

      // Buyer only signs the payment - a plain transfer, nothing privileged.
      // The memo tags it so Astro Corp's wallet activity is self-documenting.
      // The server verifies this payment landed, then mints the NFT into the
      // collection (see app/api/mint/claim) - it can't be done client-side
      // since joining the collection needs the mint delegate's signature.
      //
      // Sent via wallet.sendTransaction() (wallet-adapter's own signer+send),
      // NOT Umi's sendAndConfirm - that signs with wallet.signTransaction()
      // and broadcasts via our own RPC, but Phantom's mobile in-app browser
      // is built around signAndSendTransaction (sign+send in one call) and
      // throws a generic, unhelpful error on plain signTransaction there
      // (found 2026-10-07, mobile mints were failing 100% of the time).
      const bh = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });
      const unsignedTx = transferTokens(umi, {
        source: buyerAta,
        destination: astroAta,
        authority: umi.identity,
        amount: MINT_PRICE_BASE,
      })
        .add(addMemo(umi, { memo: mintMemo(owner) }))
        .setBlockhash(bh)
        .build(umi);
      const connection = new Connection(chainEndpoint(), "confirmed");
      paymentSignature = await wallet.sendTransaction(toWeb3JsTransaction(unsignedTx), connection, {
        maxRetries: 5,
      });
      track(paymentSignature, "Mint payment");
      await connection.confirmTransaction(
        { signature: paymentSignature, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
        "confirmed",
      );
    } catch (e) {
      setError(describeTxError(e));
      setPhase("error");
      return;
    }

    // Payment is irreversible at this point - any failure from here is ours
    // to fix, not the buyer's wallet (see claimWithSignature).
    await claimWithSignature(owner, paymentSignature);
  }

  if (!mounted) {
    return <div className="card h-40 animate-pulse p-6" />;
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
        <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
          <p className="mb-1">Which one is a weighted random draw, same price either way:</p>
          <div className="flex justify-between">
            <span className="text-foreground">Standard</span>
            <span>85%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-accent-3">Rare</span>
            <span>15%</span>
          </div>
          <p className="mt-2 border-t border-border pt-2">
            <span className="text-accent">One of One</span> isn&apos;t part of
            that draw. Every {MILESTONE_MINT_INTERVAL.toLocaleString()}th
            mint automatically gets a second, free one, on top of whichever
            of the above you drew.
          </p>
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
            <strong className="text-foreground">Mainnet. Real tokens.</strong>{" "}
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
          {stuckPayment ? "Retrying mint…" : "Minting… approve in your wallet"}
        </button>
      )}

      {phase === "error" && error && (
        <div className="flex flex-col gap-3">
          <TxErrorBanner error={error} />
          <button className="btn btn-ghost" onClick={() => setPhase("idle")}>
            Try again
          </button>
        </div>
      )}

      {phase === "stuck" && stuckPayment && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm">
            <div className="font-semibold text-bad">
              Payment went through, minting didn&apos;t
            </div>
            <p className="mt-0.5 text-muted">
              This is on our end, not your wallet - your $CHIMP wasn&apos;t
              lost. Hit retry below and we&apos;ll finish minting with the
              payment you already sent (you won&apos;t be charged again).
            </p>
            <a
              href={explorerTx(stuckPayment.signature)}
              target="_blank"
              rel="noreferrer"
              className="mono mt-2 inline-block text-xs underline"
            >
              payment transaction ↗
            </a>
          </div>
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (!wallet.publicKey) return;
              setPhase("minting");
              await claimWithSignature(wallet.publicKey.toBase58(), stuckPayment.signature);
            }}
          >
            Retry minting (no extra payment)
          </button>
        </div>
      )}

      {phase === "done" && result && (
        <div className="flex flex-col gap-2 rounded-xl border border-good/40 bg-good/10 p-4 text-sm">
          <p className="font-semibold text-good">Minted.</p>
          {result.tier && (
            <p className={`text-lg font-black ${TIER_STYLE[result.tier] ?? ""}`}>
              {result.name} · {TIER_LABEL[result.tier] ?? result.tier}
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
          {result.milestone && (
            <div className="mt-2 rounded-lg border border-accent/40 bg-accent/10 p-3">
              <p className="font-black text-accent">
                🎉 You&apos;re mint #{result.milestone.mintNumber.toLocaleString()}:
                bonus One of One!
              </p>
              <p className="mt-1 font-semibold text-accent">{result.milestone.name}</p>
              <a
                href={explorerAddress(result.milestone.asset)}
                target="_blank"
                rel="noreferrer"
                className="mono text-xs underline"
              >
                bonus NFT: {result.milestone.asset.slice(0, 8)}…
                {result.milestone.asset.slice(-8)}
              </a>
            </div>
          )}
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
