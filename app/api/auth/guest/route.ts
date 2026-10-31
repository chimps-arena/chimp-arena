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
 * Guests can't rank or add to crew scores (app/api/leaderboard), but
 * they're still free rows, so a site-wide brake stops a bot flooding the
 * table. Per-visitor limits belong in the Vercel firewall, not here.
 */
const GUEST_BURST_LIMIT = 40;
const GUEST_BURST_WINDOW_MS = 10 * 60_000;

export async function POST() {
  const hex = randomBytes(9).toString("hex"); // 18 hex chars
  const wallet = `guest_${hex}`;
  const now = new Date().toISOString();

  const db = supabaseAdmin();
  const { count } = await db
    .from("players")
    .select("wallet", { count: "exact", head: true })
    .like("wallet", "guest_%")
    .gte("created_at", new Date(Date.now() - GUEST_BURST_WINDOW_MS).toISOString());
  if ((count ?? 0) >= GUEST_BURST_LIMIT) {
    return NextResponse.json(
      { error: "Guest sign-ups are busy right now - connect a wallet, or try again in a few minutes." },
      { status: 429 },
    );
  }
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
