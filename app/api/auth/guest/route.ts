import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { setSessionCookie } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST -> { ok, wallet }
 *
 * Wallet-free guest session. Creates a throwaway player ("guest_<hex>") and
 * sets the same httpOnly session cookie the wallet flow uses, so a guest can
 * play everything. Their progress isn't tied to a real wallet.
 *
 * TODO: gate behind an env flag before mainnet.
 */
export async function POST() {
  const hex = randomBytes(9).toString("hex"); // 18 hex chars
  const wallet = `guest_${hex}`;
  const now = new Date().toISOString();

  const db = supabaseAdmin();
  const { error } = await db.from("players").insert({
    wallet,
    handle: `Guest-${hex.slice(0, 4)}`,
    last_seen: now,
  });
  if (error) {
    return NextResponse.json(
      { error: "db error", detail: error.message },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true, wallet });
  await setSessionCookie(res, wallet);
  return res;
}
