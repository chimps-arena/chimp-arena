/**
 * Client half of lib/chain/wallet-ready-tx.ts. Phantom's guidance for a
 * transaction with more than one signer: the wallet signs first, the other
 * signatures are added to the transaction the wallet returns, and we send
 * it through our own RPC with preflight on. The only other signer in our
 * transactions is the new NFT's own address keypair, generated here in the
 * buyer's browser and never sent anywhere - the server only ever sees its
 * public key.
 */
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { describeTxError } from "@/lib/chain/tx-error";

export function decodeTransaction(base64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

export async function walletSignsFirst(
  wallet: WalletContextState,
  connection: Connection,
  tx: VersionedTransaction,
  assetKeypair: Keypair,
): Promise<string> {
  if (wallet.signTransaction) {
    try {
      const signed = await wallet.signTransaction(tx);
      signed.sign([assetKeypair]);
      return await connection.sendRawTransaction(signed.serialize(), { maxRetries: 5 });
    } catch (e) {
      if (describeTxError(e).category === "rejected") throw e;
      // Some mobile in-app browsers only support sign-and-send (found
      // 2026-10-07 on Phantom mobile). Fall back to that: the asset key
      // signs first, the wallet signs and sends. Same transaction, it just
      // loses the cleaner wallet-first ordering on those browsers.
      console.warn("signTransaction failed, falling back to sendTransaction", e);
    }
  }
  tx.sign([assetKeypair]);
  return wallet.sendTransaction(tx, connection, { maxRetries: 5 });
}

export const newAssetKeypair = () => Keypair.generate();
