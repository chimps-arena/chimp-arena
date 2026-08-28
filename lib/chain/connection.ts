import { clusterApiUrl, type Cluster } from "@solana/web3.js";
import { PUBLIC_ENV } from "@/lib/env";

export const SOLANA_CLUSTER = PUBLIC_ENV.solanaCluster;

/** RPC endpoint: an explicit NEXT_PUBLIC_SOLANA_RPC, else the public cluster URL. */
export function chainEndpoint(): string {
  return PUBLIC_ENV.solanaRpc || clusterApiUrl(SOLANA_CLUSTER as Cluster);
}

/** Solana Explorer link for a tx signature, cluster-aware. */
export function explorerTx(signature: string): string {
  const q =
    SOLANA_CLUSTER === "mainnet-beta" ? "" : `?cluster=${SOLANA_CLUSTER}`;
  return `https://explorer.solana.com/tx/${signature}${q}`;
}

/** Solana Explorer link for an address, cluster-aware. */
export function explorerAddress(address: string): string {
  const q =
    SOLANA_CLUSTER === "mainnet-beta" ? "" : `?cluster=${SOLANA_CLUSTER}`;
  return `https://explorer.solana.com/address/${address}${q}`;
}
