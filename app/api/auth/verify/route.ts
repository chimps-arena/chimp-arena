import { NextResponse } from "next/server";
import { verifyShortLived } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import {
  buildChallenge,
  isLikelySolanaAddress,
  verifyMessageSignature,
  verifySignInTransaction,
} from "@/lib/auth/solana-verify";
import { supabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_HANDLE } from "@/lib/game/config";
import { recordReferral } from "@/lib/referral-server";

export const runtime = "nodejs";

/**
 * POST { wallet, challengeToken, signature | transaction } -> { ok, wallet }
 * On success, sets the httpOnly session cookie and upserts the player row.
 *
 * `signature`: the signed challenge message (Ledger's off-chain envelope
 * accepted too). `transaction`: base64 memo transaction holding the
 * challenge, signed but never sent - the Ledger fallback (devlog #25).
 */
export async function POST(req: Request) {
  let body: { wallet?: unknown; signature?: unknown; transaction?: unknown; challengeToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { wallet, signature, transaction, challengeToken } = body;
  if (
    !isLikelySolanaAddress(wallet) ||
    (typeof signature !== "string" && typeof transaction !== "string") ||
    typeof challengeToken !== "string"
  ) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const claims = await verifyShortLived<{ wallet: string; nonce: string }>(
    challengeToken,
    "chimp-arena:challenge",
  );
  if (!claims || claims.wallet !== wallet) {
    return NextResponse.json(
      { error: "challenge expired, try again" },
      { status: 401 },
    );
  }

  const message = buildChallenge(wallet, claims.nonce);
  const valid =
    typeof transaction === "string"
      ? transaction.length <= 4000 && verifySignInTransaction(transaction, message, wallet)
      : typeof signature === "string" && verifyMessageSignature(message, signature, wallet);
  if (!valid) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const now = new Date().toISOString();

  // Create the row on first sign-in only; never clobber an existing
  // handle / xp / crew.
  const { data: created, error: insertError } = await db
    .from("players")
    .upsert(
      { wallet, handle: DEFAULT_HANDLE(wallet), last_seen: now },
      { onConflict: "wallet", ignoreDuplicates: true },
    )
    .select("wallet");

  if (insertError) {
    return NextResponse.json(
      { error: "db error", detail: insertError.message },
      { status: 500 },
    );
  }
  // ignoreDuplicates returns the row only when it was just created, so a
  // returning player is never re-attributed to whoever shared a link.
  if (created?.length) await recordReferral(db, req, wallet);

  // Touch last_seen for returning players (no-op fields for brand-new rows).
  await db.from("players").update({ last_seen: now }).eq("wallet", wallet);

  const res = NextResponse.json({ ok: true, wallet });
  await setSessionCookie(res, wallet);
  return res;
}
