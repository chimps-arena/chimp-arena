import nacl from "tweetnacl";
import bs58 from "bs58";

/**
 * Human-readable sign-in challenge. The nonce ties it to one /nonce call.
 *
 * Single line, deliberately - a multi-line message here (this used to be 6
 * lines with blank-line separators) is very likely what's triggering
 * Phantom's "signature request cannot be shown due to invalid formatting"
 * error on desktop (2026-09-29): the display:"utf8" mode in
 * components/wallet-connect.tsx has to render this text directly in the
 * popup, and Phantom's renderer appears to choke on embedded newlines in
 * that mode on some extension versions. The message content is otherwise
 * unchanged - same wallet+nonce binding, same verifySignature check.
 */
export function buildChallenge(wallet: string, nonce: string): string {
  return `CHIMP Arena sign-in - wallet ${wallet}, nonce ${nonce}. Free, no transaction.`;
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
 * `signature` is base58-encoded (the wallet-adapter `signMessage` result,
 * bs58-encoded client-side).
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
