/**
 * Server-only. Finishes a buyer-signed transaction the way Phantom's own
 * docs ask (docs.phantom.com/developer-powertools/domain-and-transaction-warnings):
 * "This dApp could be malicious" appears when Phantom can't simulate a
 * transaction confidently, and their fixes are
 *  - the wallet signs FIRST - nothing arrives pre-signed (see
 *    lib/chain/wallet-signs-first.ts for the client half),
 *  - simulate it ourselves before asking for a signature, so a transaction
 *    that would fail never reaches the wallet,
 *  - set the compute unit limit explicitly.
 * Our mint and property transactions used to arrive already signed by the
 * new asset's keypair, which is exactly the shape that blocks Phantom's
 * simulation (no balance changes shown, red warning).
 */
import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { TransactionBuilder, Umi } from "@metaplex-foundation/umi";
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { chainEndpoint } from "@/lib/chain/connection";

export class SimulationFailed extends Error {
  constructor(
    message: string,
    readonly logs: string[],
  ) {
    super(message);
  }
}

/** Plain-language reason for the common ways a buyer's transaction fails. */
function explain(err: unknown, logs: string[]): string {
  const text = `${JSON.stringify(err)} ${logs.join(" ")}`;
  if (/insufficient lamports|InsufficientFundsForRent|"InsufficientFundsForFee"|AccountNotFound/i.test(text)) {
    return "Not enough SOL in this wallet - you need a few thousandths of a SOL for the network fee and the NFT's storage rent.";
  }
  if (/insufficient funds/i.test(text)) return "Not enough $CHIMP in this wallet.";
  return "This transaction would fail on-chain, so we stopped before asking you to sign. Please try again.";
}

const toWeb3 = (umi: Umi, builder: TransactionBuilder) =>
  toWeb3JsTransaction(builder.build(umi)) as VersionedTransaction;

/**
 * Simulates `builder` (fee payer and blockhash already set, every signer a
 * noop placeholder), then rebuilds it with a compute limit sized from the
 * simulation. Returns the UNSIGNED transaction, base64. Throws
 * SimulationFailed with a buyer-facing message if it would fail.
 */
export async function walletReadyTransaction(umi: Umi, builder: TransactionBuilder): Promise<string> {
  const conn = new Connection(chainEndpoint(), "confirmed");
  const probe = builder.prepend(setComputeUnitLimit(umi, { units: 1_400_000 }));
  const sim = await conn.simulateTransaction(toWeb3(umi, probe), {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  const logs = sim.value.logs ?? [];
  if (sim.value.err) {
    throw new SimulationFailed(explain(sim.value.err, logs), logs);
  }
  const units = Math.ceil((sim.value.unitsConsumed ?? 200_000) * 1.2) + 1_000;
  const tx = toWeb3(umi, builder.prepend(setComputeUnitLimit(umi, { units })));
  return Buffer.from(tx.serialize()).toString("base64");
}
