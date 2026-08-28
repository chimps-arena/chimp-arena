import nacl from "tweetnacl";
import bs58 from "bs58";

/** Human-readable sign-in challenge. The nonce ties it to one /nonce call. */
export function buildChallenge(wallet: string, nonce: string): string {
  return [
    "CHIMP Arena wants you to sign in with your Solana account.",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    "",
    "Signing is free and does not authorize any transaction.",
  ].join("\n");
}

export function isLikelySolanaAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}

/**
 * Verify an ed25519 signature over `message` for `wallet` (base58 pubkey).
 * `signature` is base58-encoded (what connectPhantom returns).
 */
export function verifySignature(
  message: string,
  signatureB58: string,
  wallet: string,
): boolean {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signatureB58);
    const pubBytes = bs58.decode(wallet);
    if (sigBytes.length !== 64 || pubBytes.length !== 32) return false;
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch {
    return false;
  }
}
