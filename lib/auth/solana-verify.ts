import nacl from "tweetnacl";
import bs58 from "bs58";
import { VersionedTransaction } from "@solana/web3.js";

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

/* ------------------------------------------------------------------------
 * Ledger support (devlog #25). Two ways a hardware wallet signs in:
 *
 * 1. signMessage, but wrapped. Ledger's Solana app only signs off-chain
 *    messages inside Solana's "\xffsolana offchain" envelope, so the
 *    signature covers the envelope, not our plain text - the "bad
 *    signature" Chalk saw. We accept the plain text or the same text in
 *    either envelope layout (the short one older Ledger apps use, and the
 *    full v0 spec). Same nonce-bound text either way, so it proves the
 *    same thing.
 *
 * 2. A signed-but-never-sent transaction, for Ledgers whose app refuses
 *    off-chain messages outright (0x6a81). The transaction must hold
 *    nothing but our sign-in memo (plus optional compute-budget
 *    instructions Phantom may add), with the wallet as fee payer, so the
 *    signature can't be repurposed for anything else. We never broadcast
 *    it; if someone else did, it would only post the memo.
 * --------------------------------------------------------------------- */

const OFFCHAIN_DOMAIN = new Uint8Array([0xff, ...new TextEncoder().encode("solana offchain")]);

function u16le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Every byte layout a wallet might have signed for `message`. */
function signedForms(message: string, pubBytes: Uint8Array): Uint8Array[] {
  const msg = new TextEncoder().encode(message);
  const forms: Uint8Array[] = [msg];
  for (const format of [0, 1]) {
    // short layout: domain, version 0, format, length, message
    forms.push(concat(OFFCHAIN_DOMAIN, new Uint8Array([0, format]), u16le(msg.length), msg));
    // full v0 spec: domain, version 0, 32-byte app domain, format, 1 signer, signer, length, message
    forms.push(
      concat(
        OFFCHAIN_DOMAIN,
        new Uint8Array([0]),
        new Uint8Array(32),
        new Uint8Array([format, 1]),
        pubBytes,
        u16le(msg.length),
        msg,
      ),
    );
  }
  return forms;
}

/** Like verifySignature, but also accepts the Ledger off-chain envelope. */
export function verifyMessageSignature(message: string, signatureB58: string, wallet: string): boolean {
  try {
    const sigBytes = bs58.decode(signatureB58);
    const pubBytes = bs58.decode(wallet);
    if (sigBytes.length !== 64 || pubBytes.length !== 32) return false;
    return signedForms(message, pubBytes).some((m) => nacl.sign.detached.verify(m, sigBytes, pubBytes));
  } catch {
    return false;
  }
}

export const MEMO_PROGRAM_IDS = [
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
];
const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

/**
 * Verify a sign-in transaction (base64, wallet-signed, never sent): the
 * wallet is the fee payer and signed it, and it does nothing but post
 * exactly `message` as a memo.
 */
export function verifySignInTransaction(txBase64: string, message: string, wallet: string): boolean {
  try {
    const tx = VersionedTransaction.deserialize(Buffer.from(txBase64, "base64"));
    const msg = tx.message;
    if (msg.addressTableLookups.length > 0) return false;
    const keys = msg.staticAccountKeys.map((k) => k.toBase58());
    if (keys[0] !== wallet) return false; // fee payer

    let memoMatches = false;
    for (const ix of msg.compiledInstructions) {
      const program = keys[ix.programIdIndex];
      if (MEMO_PROGRAM_IDS.includes(program)) {
        if (new TextDecoder().decode(ix.data) !== message) return false;
        memoMatches = true;
      } else if (program !== COMPUTE_BUDGET_PROGRAM_ID) {
        return false;
      }
    }
    if (!memoMatches) return false;

    const sig = tx.signatures[0];
    if (!sig || sig.every((b) => b === 0)) return false;
    return nacl.sign.detached.verify(msg.serialize(), sig, bs58.decode(wallet));
  } catch {
    return false;
  }
}
