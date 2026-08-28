"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SOLANA_CLUSTER } from "@/lib/chain/connection";

/**
 * Stopgap until the fee-payer relay (roadmap #28) lands: lets a connected
 * wallet pull devnet SOL so it can pay transaction fees. Renders nothing on
 * testnet/mainnet.
 */
export function DevnetFaucet() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState<string | null>(null);

  if (SOLANA_CLUSTER !== "devnet" || !publicKey) return null;

  async function drip() {
    if (!publicKey) return;
    setStatus("loading");
    setMsg(null);
    try {
      const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
        "confirmed",
      );
      setStatus("done");
      setMsg("1 devnet SOL added.");
    } catch (e) {
      setStatus("error");
      setMsg(
        e instanceof Error
          ? `Faucet failed: ${e.message}. Try https://faucet.solana.com`
          : "Faucet failed.",
      );
    }
  }

  return (
    <div className="text-xs">
      <button
        onClick={drip}
        disabled={status === "loading"}
        className="btn btn-ghost px-2 py-1 text-xs"
      >
        {status === "loading" ? "Requesting…" : "Get devnet SOL"}
      </button>
      {msg && (
        <span
          className={`ml-2 ${status === "error" ? "text-bad" : "text-good"}`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
