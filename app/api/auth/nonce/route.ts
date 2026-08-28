import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { signShortLived } from "@/lib/auth/jwt";
import { buildChallenge, isLikelySolanaAddress } from "@/lib/auth/solana-verify";

export const runtime = "nodejs";

/**
 * POST { wallet } -> { message, challengeToken }
 *
 * Stateless: the nonce lives inside a 5-minute signed challengeToken instead of
 * a database row. The client signs `message`, then posts it back with the token
 * to /api/auth/verify.
 */
export async function POST(req: Request) {
  let wallet: unknown;
  try {
    ({ wallet } = await req.json());
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

  return NextResponse.json({ message, challengeToken });
}
