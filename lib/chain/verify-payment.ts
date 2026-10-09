import { Connection, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { chainEndpoint } from "@/lib/chain/connection";

/**
 * Shared "did this $CHIMP transfer actually land on-chain" check - the same
 * scan used inline in app/api/mint/claim, app/api/land/claim, app/api/me
 * (PATCH) and app/api/market/resale/claim, pulled out here so the new
 * mining/tool/resource-market routes don't duplicate it a fourth+ time.
 * Changing the existing call sites to use this is optional, not required.
 */
export function findTransfer(
  tx: ParsedTransactionWithMeta,
  sourceAta: string,
  destAta: string,
  minBase: bigint,
): boolean {
  return tx.transaction.message.instructions.some((ix) => {
    if (!("parsed" in ix) || ix.program !== "spl-token") return false;
    const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
    if (parsed.type !== "transfer" && parsed.type !== "transferChecked") return false;
    const info = parsed.info ?? {};
    if (info.destination !== destAta || info.source !== sourceAta) return false;
    const raw = BigInt(
      (info.tokenAmount as { amount?: string } | undefined)?.amount ??
        (info.amount as string | undefined) ??
        "0",
    );
    return raw >= minBase;
  });
}

let sharedConn: Connection | null = null;

/** One shared server-side Connection, same endpoint every route already uses. */
export function serverConn(): Connection {
  if (!sharedConn) sharedConn = new Connection(chainEndpoint(), "confirmed");
  return sharedConn;
}

/** Fetches a transaction and returns null (never throws) if it's missing/failed. */
export async function fetchOkTransaction(
  signature: string,
): Promise<ParsedTransactionWithMeta | null> {
  let tx: ParsedTransactionWithMeta | null;
  try {
    tx = await serverConn().getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  } catch {
    return null;
  }
  if (!tx || tx.meta?.err) return null;
  return tx;
}
