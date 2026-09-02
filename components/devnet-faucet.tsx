"use client";

import { useState } from "react";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { SOLANA_CLUSTER, chainEndpoint } from "@/lib/chain/connection";
import { connectPhantom, phantomAddress, phantomInstalled } from "@/lib/phantom";

/**
 * Stopgap until the fee-payer relay (roadmap #28) lands: pulls devnet SOL to
 * the connected Phantom wallet so it can pay transaction fees. Devnet only.
 */
export function DevnetFaucet() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState<string | null>(null);

  if (SOLANA_CLUSTER !== "devnet" || !phantomInstalled()) return null;

  async function drip() {
    setStatus("loading");
    setMsg(null);
    try {
      const addr = phantomAddress() ?? (await connectPhantom());
      const owner = new PublicKey(addr);
      const connection = new Connection(chainEndpoint(), "confirmed");
      const sig = await connection.requestAirdrop(owner, LAMPORTS_PER_SOL);
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: bh.blockhash,
          lastValidBlockHeight: bh.lastValidBlockHeight,
        },
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
        <span className={`ml-2 ${status === "error" ? "text-bad" : "text-good"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
