"use client";

import { useEffect, useMemo, useState } from "react";
import { Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { fetchToken, findAssociatedTokenPda, mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { AccountNotFoundError, publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint, explorerAddress, explorerTx } from "@/lib/chain/connection";
import { SOLANA_CLUSTER } from "@/lib/chain/connection";
import { describeTxError, type DescribedTxError } from "@/lib/chain/tx-error";
import { decodeTransaction, newAssetKeypair, walletSignsFirst } from "@/lib/chain/wallet-signs-first";
import { TxErrorBanner } from "@/components/tx-error-banner";
import { useTxTracker } from "@/components/tx-tracker";
import { SALES_UNAVAILABLE_MESSAGE, useSalesAvailability } from "@/components/use-sales-availability";
import {
  ASTRO_CORP_WALLET,
  CHIMP_MINT,
  CHIMP_DECIMALS,
  MILESTONE_MINT_INTERVAL,
  MINT_PRICE_BASE,
  MINT_PRICE_CHIMP,
} from "@/lib/chain/mint-config";

type Phase = "idle" | "confirm" | "minting" | "done" | "error" | "stuck";

interface Milestone {
  mintNumber: number;
  asset: string;
  name: string;
  imageUrl?: string;
}

interface Result {
  asset: string;
  signature: string;
  tier?: string;
  name?: string;
  imageUrl?: string;
  milestone?: Milestone;
  /** Minted fine, but a follow-up step (collection join) didn't finish. */
  warning?: string;
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

/** A short synthesized chime - no licensed audio asset needed, and safe to
 *  autoplay since it only ever fires right after the buyer's own mint click.
 *  A richer four-note run for the milestone bonus, a plain two-note one
 *  otherwise. Swallows failures (unsupported/blocked Web Audio) since the
 *  reveal is still complete visually without sound. */
function playMintChime(bonus: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = bonus ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 783.99];
    notes.forEach((freq, i) => {
      const start = now + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.6);
    });
    setTimeout(() => void ctx.close(), (notes.length * 100 + 700));
  } catch {
    // Web Audio unsupported/blocked - reveal still works without sound.
  }
}

/** The mint result's reveal beat: a brief pause (builds anticipation) then
 *  the actual art scales/fades/glows in, with the chime timed to the same
 *  moment - replaces an instant plain-text result. */
function MintReveal({ result }: { result: Result }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setRevealed(true);
      playMintChime(!!result.milestone);
    }, 550);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <div
      className={`mx-auto h-48 w-48 overflow-hidden rounded-2xl border-2 border-accent transition-all duration-700 ease-out ${
        revealed ? "glow-yellow scale-100 opacity-100" : "scale-75 opacity-0"
      }`}
    >
      {result.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.imageUrl}
          alt={result.name ?? "Astrochimp"}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export function ChimpMint() {
  const wallet = useWallet();
  const { track } = useTxTracker();
  const salesAvailable = useSalesAvailability();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<DescribedTxError | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  /** Set when the combined transaction lands on-chain (the NFT is already
   *  real and in the buyer's wallet) but /api/mint/confirm fails to record
   *  it - lets "try again" retry just the confirm call, nothing to pay. */
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
    } catch (e) {
      // AccountNotFoundError (no ATA yet) genuinely means zero - any other
      // failure is an RPC problem, not a real balance, so leave it unset
      // ("check balance") rather than confidently showing a wrong 0.
      setBalance(e instanceof AccountNotFoundError ? 0 : null);
    }
  }

  /** Records + finalizes an already-landed combined transaction - shared by
   *  a fresh mint and by retrying one whose confirm call failed. By the
   *  time this is called, the buyer's NFT is already real and in their
   *  wallet regardless of what happens here (see mint()) - this is just our
   *  bookkeeping (and the milestone-bonus roll) catching up. */
  async function confirmSignature(owner: string, signature: string) {
    const confirmRes = await fetch("/api/mint/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: owner, signature }),
    });
    const confirmed = await confirmRes.json().catch(() => ({}));
    if (!confirmRes.ok) {
      setStuckPayment({ signature, raw: confirmed.error || "unknown error" });
      setPhase("stuck");
      return;
    }
    setStuckPayment(null);
    setResult({
      asset: confirmed.asset,
      signature: confirmed.signature,
      tier: confirmed.tier,
      name: confirmed.name,
      imageUrl: confirmed.imageUrl,
      milestone: confirmed.milestone,
      warning: confirmed.warning,
    });
    setPhase("done");
    void checkBalance();
  }

  async function mint() {
    if (!wallet.publicKey) return;
    setPhase("minting");
    setError(null);
    const owner = wallet.publicKey.toBase58();

    let signature: string;
    try {
      // Preflight: enough $CHIMP? AccountNotFoundError (no ATA yet) genuinely
      // means zero - any other failure is an RPC problem and must not be
      // reported as an empty wallet, which would block a real holder from
      // minting and look identical to a genuinely empty one.
      let held: bigint;
      try {
        const buyerAta = findAssociatedTokenPda(umi, {
          mint: publicKey(CHIMP_MINT),
          owner: publicKey(owner),
        });
        held = (await fetchToken(umi, buyerAta)).amount;
      } catch (e) {
        if (e instanceof AccountNotFoundError) {
          throw new Error("This wallet holds no $CHIMP.");
        }
        throw new Error("Couldn't check your $CHIMP balance - the chain RPC may be having trouble. Try again shortly.");
      }
      if (held < MINT_PRICE_BASE) {
        throw new Error(
          `Need ${MINT_PRICE_CHIMP.toLocaleString()} $CHIMP. This wallet has ${(
            Number(held) /
            10 ** CHIMP_DECIMALS
          ).toLocaleString()}.`,
        );
      }

      // The server builds ONE unsigned transaction containing both the
      // $CHIMP payment and the NFT creation, with this wallet as fee payer -
      // the buyer covers their own mint's SOL rent (see
      // app/api/mint/prepare). The new NFT's address keypair is made here
      // and never leaves the browser; this wallet signs first, then that
      // keypair (Phantom's requirement for a clean, simulated preview).
      const assetKeypair = newAssetKeypair();
      const prepRes = await fetch("/api/mint/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: owner, asset: assetKeypair.publicKey.toBase58() }),
      });
      const prepared = await prepRes.json().catch(() => ({}));
      if (!prepRes.ok) {
        throw new Error(prepared.error || "Could not prepare the mint - try again.");
      }

      const connection = new Connection(chainEndpoint(), "confirmed");
      signature = await walletSignsFirst(wallet, connection, decodeTransaction(prepared.transaction), assetKeypair);
      track(signature, "Mint");
      await connection.confirmTransaction(
        {
          signature,
          blockhash: prepared.blockhash,
          lastValidBlockHeight: prepared.lastValidBlockHeight,
        },
        "confirmed",
      );
    } catch (e) {
      setError(describeTxError(e));
      setPhase("error");
      return;
    }

    // The payment and the NFT are both already final and irreversible
    // on-chain at this point - any failure from here is just our
    // bookkeeping catching up, never the buyer's wallet (see
    // confirmSignature).
    await confirmSignature(owner, signature);
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

      {phase === "idle" && salesAvailable === false && (
        <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {SALES_UNAVAILABLE_MESSAGE}
        </p>
      )}

      {phase === "idle" && (
        <button
          className="btn btn-primary"
          disabled={salesAvailable === false}
          onClick={() => setPhase("confirm")}
        >
          {salesAvailable === false ? "Minting temporarily unavailable" : "Mint an Astrochimp"}
        </button>
      )}

      {phase === "confirm" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            <strong className="text-foreground">Mainnet. Real tokens.</strong>{" "}
            You will send {MINT_PRICE_CHIMP.toLocaleString()} $CHIMP to Astro Corp
            and receive one Astrochimp NFT, in a single transaction. This can’t be
            undone. You&apos;ll also need a small amount of SOL in this wallet
            (a few thousandths) to cover the network fee and the NFT&apos;s
            on-chain storage rent.
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
          {stuckPayment ? "Finishing up…" : "Minting… approve in your wallet"}
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
              Your NFT minted - we just need a second to record it
            </div>
            <p className="mt-0.5 text-muted">
              The transaction already landed on-chain, so the NFT is real and
              in your wallet right now - this is only our bookkeeping
              catching up. Hit retry below, nothing will be charged again.
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
            className="btn btn-primary"
            onClick={async () => {
              if (!wallet.publicKey) return;
              setPhase("minting");
              await confirmSignature(wallet.publicKey.toBase58(), stuckPayment.signature);
            }}
          >
            Retry recording (no extra payment)
          </button>
        </div>
      )}

      {phase === "done" && result && (
        <div className="flex flex-col gap-3 rounded-xl border border-good/40 bg-good/10 p-4 text-sm">
          <p className="text-center font-semibold text-good">Minted.</p>
          {result.warning && (
            <p className="rounded-lg border border-bad/40 bg-bad/10 p-2 text-xs text-bad">
              {result.warning}
            </p>
          )}
          <MintReveal key={result.asset} result={result} />
          {result.tier && (
            <p className={`text-center text-lg font-black ${TIER_STYLE[result.tier] ?? ""}`}>
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
            <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3">
              <p className="font-black text-accent">
                🎉 You&apos;re mint #{result.milestone.mintNumber.toLocaleString()}:
                bonus One of One!
              </p>
              {result.milestone.imageUrl && (
                <div className="glow-magenta h-28 w-28 overflow-hidden rounded-xl border-2 border-accent-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.milestone.imageUrl}
                    alt={result.milestone.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
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
