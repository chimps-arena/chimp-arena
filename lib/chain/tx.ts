import {
  Connection,
  VersionedTransaction,
  type TransactionSignature,
} from "@solana/web3.js";

/**
 * The uniform client-side transaction flow (see ECONOMY.md §10):
 *   1. server builds an unsigned VersionedTransaction (fee payer set, its own
 *      instructions + partial signature attached) and returns it base64-encoded
 *   2. `signAndSend` deserializes it, simulates, has the wallet sign it once,
 *      sends, and confirms
 *   3. on a stale-blockhash failure it asks the server to rebuild once
 *
 * No transactions exist yet (roadmap Group G) — this is the shared entry point
 * every future on-chain action (claim, mint, buy) will call.
 */

export interface TxSigner {
  signTransaction<T extends VersionedTransaction>(tx: T): Promise<T>;
}

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function signAndSend(
  connection: Connection,
  wallet: TxSigner,
  base64Tx: string,
  opts: { rebuild?: () => Promise<string>; commitment?: "processed" | "confirmed" | "finalized" } = {},
): Promise<TransactionSignature> {
  const commitment = opts.commitment ?? "confirmed";
  let raw = base64Tx;

  for (let attempt = 0; attempt < 2; attempt++) {
    const tx = VersionedTransaction.deserialize(b64ToBytes(raw));

    const sim = await connection.simulateTransaction(tx, {
      replaceRecentBlockhash: false,
      sigVerify: false,
    });
    if (sim.value.err) {
      const logs = (sim.value.logs ?? []).slice(-3).join(" | ");
      throw new Error(
        `simulation failed: ${JSON.stringify(sim.value.err)}${logs ? ` — ${logs}` : ""}`,
      );
    }

    const signed = await wallet.signTransaction(tx);
    try {
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
        commitment,
      );
      return signature;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const stale = /blockhash|block height exceeded|expired|not found/i.test(msg);
      if (stale && opts.rebuild && attempt === 0) {
        raw = await opts.rebuild();
        continue;
      }
      throw e;
    }
  }
  throw new Error("transaction failed after one rebuild retry");
}
