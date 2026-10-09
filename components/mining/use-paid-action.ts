"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import type { Umi, TransactionBuilder } from "@metaplex-foundation/umi";
import { chainEndpoint } from "@/lib/chain/connection";
import type { DescribedTxError } from "@/lib/chain/tx-error";
import { useTxTracker } from "@/components/tx-tracker";

/**
 * Shared "pay, track, remember the signature" logic for the mining permit,
 * tool upgrades, and resource-market purchases - the same pay-then-verify
 * shape already written 3x in chimp-mint.tsx/land-market.tsx/handle-editor.tsx,
 * but persisted to localStorage too so even a page reload after a
 * successful payment doesn't risk paying twice - the caller resubmits the
 * remembered signature to its own API route instead of building a new
 * transaction.
 */
export function usePaidAction(storageKey: string) {
  const wallet = useWallet();
  const { track } = useTxTracker();
  const [error, setError] = useState<DescribedTxError | null>(null);
  const [stuckSignature, setStuckSignatureState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });

  const setStuckSignature = useCallback(
    (sig: string | null) => {
      setStuckSignatureState(sig);
      try {
        if (sig) window.localStorage.setItem(storageKey, sig);
        else window.localStorage.removeItem(storageKey);
      } catch {
        // best-effort only - losing this just means a failed follow-up
        // step would ask to pay again instead of offering a free retry
      }
    },
    [storageKey],
  );

  /** Builds, sends, tracks, and confirms a payment - returns the signature. */
  const pay = useCallback(
    async (umi: Umi, builder: TransactionBuilder, label: string): Promise<string> => {
      setError(null);
      const bh = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });
      const unsignedTx = builder.setBlockhash(bh).build(umi);
      const connection = new Connection(chainEndpoint(), "confirmed");
      const signature = await wallet.sendTransaction(toWeb3JsTransaction(unsignedTx), connection, {
        maxRetries: 5,
      });
      track(signature, label);
      await connection.confirmTransaction(
        { signature, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
        "confirmed",
      );
      setStuckSignature(signature);
      return signature;
    },
    [wallet, track, setStuckSignature],
  );

  return { wallet, error, setError, stuckSignature, setStuckSignature, pay };
}
