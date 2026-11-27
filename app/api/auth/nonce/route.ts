import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Connection } from "@solana/web3.js";
import { chainEndpoint } from "@/lib/chain/connection";
import { signShortLived } from "@/lib/auth/jwt";
import { buildChallenge, isLikelySolanaAddress } from "@/lib/auth/solana-verify";

export const runtime = "nodejs";

/**
 * POST { wallet, mode? } -> { message, challengeToken, blockhash? }
 *
 * mode "tx" (Ledger sign-in, devlog #25) also returns a recent blockhash for
 * the memo transaction the wallet signs instead of a message - see
 * verifySignInTransaction. The transaction is never sent.
 *
 * Stateless: the nonce lives inside a 5-minute signed challengeToken instead of
 * a database row. The client signs `message`, then posts it back with the token
 * to /api/auth/verify.
 */
export async function POST(req: Request) {
  let wallet: unknown;
  let mode: unknown;
  try {
    ({ wallet, mode } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!isLikelySolanaAddress(wallet)) {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }

  const nonce = randomBytes(16).toString("hex");
  const message = buildChallenge(wallet, nonce);
  const challengeToken = await signShortLived(
    { wallet, nonce },
    "chimp-arena:challenge",
    "5m",
  );

  if (mode === "tx") {
    try {
      const { blockhash } = await new Connection(chainEndpoint(), "confirmed").getLatestBlockhash();
      return NextResponse.json({ message, challengeToken, blockhash });
    } catch {
      return NextResponse.json({ error: "Couldn't reach Solana - try again in a moment." }, { status: 503 });
    }
  }
  return NextResponse.json({ message, challengeToken });
}
