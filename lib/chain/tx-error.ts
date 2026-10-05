/**
 * Shared error taxonomy for transactions the PLAYER'S OWN wallet signs and
 * sends (mint payment, rename payment, land purchase, admin actions). Do
 * NOT use this for errors coming back from our own API routes when the
 * failure happened in a server-held wallet (e.g. the mint delegate) - that
 * category of failure is about our infrastructure, not the player's
 * wallet, and needs its own message (see describeServerMintError below).
 * Conflating the two would tell a buyer to "add SOL to your wallet" for a
 * problem that's actually ours - that exact mix-up is why this file exists
 * (2026-10-04, the mint-delegate-ran-dry incident).
 */

export type TxErrorCategory =
  | "rejected"
  | "expired"
  | "insufficient-sol"
  | "insufficient-token"
  | "network"
  | "wrong-network"
  | "simulation-failed"
  | "unknown";

export interface DescribedTxError {
  category: TxErrorCategory;
  title: string;
  detail: string;
  /** Worth showing a "try again" affordance for this category. */
  retryable: boolean;
}

export function describeTxError(e: unknown): DescribedTxError {
  const msg = e instanceof Error ? e.message : String(e);

  if (/user rejected|reject|denied|cancel/i.test(msg)) {
    return {
      category: "rejected",
      title: "Cancelled",
      detail: "You closed the wallet prompt or declined to sign.",
      retryable: true,
    };
  }

  if (
    /block height exceeded|blockhash not found|has already been processed|TransactionExpiredBlockheightExceededError/i.test(
      msg,
    )
  ) {
    return {
      category: "expired",
      title: "Took too long",
      detail:
        "The transaction expired before it confirmed - usually just network congestion. Try again.",
      retryable: true,
    };
  }

  // Wrong-network detection is best-effort: wallets don't reliably expose
  // their own selected cluster to a dapp, so this leans on error signatures
  // that tend to show up when a wallet is pointed at a different cluster
  // than this app's RPC.
  if (/genesis hash mismatch|unknown signer|wrong network|invalid blockhash/i.test(msg)) {
    return {
      category: "wrong-network",
      title: "Wrong network?",
      detail:
        "This looks like it might be a wallet/network mismatch. Check that your wallet is set to Solana mainnet, not devnet or testnet.",
      retryable: true,
    };
  }

  if (/insufficient funds for rent|insufficient lamports|0x1\b/i.test(msg)) {
    return {
      category: "insufficient-sol",
      title: "Needs more SOL",
      detail:
        "Your wallet doesn't have enough SOL to cover network fees. A small top-up (even 0.01 SOL) is usually enough.",
      retryable: true,
    };
  }

  if (/insufficient.*(token|funds)|TokenAccountNotFoundError|0x1(771|772)\b/i.test(msg)) {
    return {
      category: "insufficient-token",
      title: "Not enough $CHIMP",
      detail: "This wallet doesn't hold enough $CHIMP to cover the price.",
      retryable: true,
    };
  }

  if (/fetch failed|network ?error|ECONNRESET|timed? ?out|503|502/i.test(msg)) {
    return {
      category: "network",
      title: "Network hiccup",
      detail: "Couldn't reach Solana right now. Try again in a moment.",
      retryable: true,
    };
  }

  if (/simulation failed/i.test(msg)) {
    return {
      category: "simulation-failed",
      title: "Transaction wouldn't go through",
      detail:
        "The network rejected this before it was sent, so nothing was charged. If this keeps happening, let us know.",
      retryable: true,
    };
  }

  // A bare, uninformative message like "Unexpected error" usually means the
  // wallet's own bridge (often a mobile in-app browser) hit something it
  // doesn't have a specific error for - frequently a flaky connection
  // interrupting the wallet handshake, not a new failure mode.
  const generic = !msg || /^unexpected error\.?$/i.test(msg.trim());
  return {
    category: "unknown",
    title: "Something went wrong",
    detail: generic
      ? "Your wallet reported a generic error, often caused by a weak or dropped connection mid-approval. Check your connection and try again."
      : msg,
    retryable: true,
  };
}
