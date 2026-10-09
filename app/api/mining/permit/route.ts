import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchOkTransaction, findTransfer } from "@/lib/chain/verify-payment";
import { ASTRO_CORP_WALLET, CHIMP_MINT, MINING_PERMIT_PRICE_BASE } from "@/lib/chain/mint-config";

export const runtime = "nodejs";

/**
 * POST { signature } -> { ok, permitId }
 *
 * Verifies the player's own $CHIMP permit-fee transfer landed on-chain, then
 * records a mining_permits row - the payment is never lost even if the
 * player never actually starts a run with it (the credit just sits unused
 * until start_mining_permit claims it). A payment is never charged twice:
 * a duplicate signature either belongs to this same wallet (idempotent,
 * returns the existing permit) or is rejected outright.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.wallet.startsWith("guest_")) {
    return NextResponse.json({ error: "mining needs a real wallet" }, { status: 403 });
  }

  let body: { signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { signature } = body;
  if (typeof signature !== "string") {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let buyerPk: PublicKey;
  try {
    buyerPk = new PublicKey(session.wallet);
  } catch {
    return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  }

  const tx = await fetchOkTransaction(signature);
  if (!tx) {
    return NextResponse.json({ error: "transaction not found or failed" }, { status: 422 });
  }

  const mint = new PublicKey(CHIMP_MINT);
  const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk).toBase58();
  const astroAta = getAssociatedTokenAddressSync(mint, new PublicKey(ASTRO_CORP_WALLET)).toBase58();

  if (!findTransfer(tx, buyerAta, astroAta, MINING_PERMIT_PRICE_BASE)) {
    return NextResponse.json({ error: "payment not found in that transaction" }, { status: 422 });
  }

  const db = supabaseAdmin();
  const { data: inserted, error } = await db
    .from("mining_permits")
    .insert({ tx_signature: signature, wallet: session.wallet })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Same signature submitted twice - if it's this wallet's own permit,
      // treat the retry as a success rather than an error.
      const { data: existing } = await db
        .from("mining_permits")
        .select("id, wallet")
        .eq("tx_signature", signature)
        .maybeSingle();
      if (existing?.wallet === session.wallet) {
        return NextResponse.json({ ok: true, permitId: existing.id });
      }
      return NextResponse.json({ error: "payment already used" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, permitId: inserted.id });
}
