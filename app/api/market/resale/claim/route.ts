import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PUBLIC_ENV } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ASTRO_CORP_WALLET, CHIMP_DECIMALS, CHIMP_MINT } from "@/lib/chain/market-config";
import { MARKETPLACE } from "@/lib/game/sinks";

export const runtime = "nodejs";

const endpoint =
  PUBLIC_ENV.solanaRpc ||
  clusterApiUrl(
    (PUBLIC_ENV.solanaCluster === "mainnet-beta"
      ? "mainnet-beta"
      : "devnet") as "mainnet-beta" | "devnet",
  );
const conn = new Connection(endpoint, "confirmed");

// Math.round guards against float noise (0.03 isn't exact in binary FP).
const FEE_PCT = BigInt(Math.round(MARKETPLACE.feeRate * 100));

/**
 * POST { propertyId, wallet, signature } -> { ok, property }
 *
 * Buys a resale listing. Verifies the transaction actually split the
 * listed price: (100-fee)% to the CURRENT owner's ATA, fee% to Astro Corp's,
 * both from the buyer's ATA - using the price/owner in the database, never
 * anything the client claims - THEN transfers ownership. Guarded by
 * `.eq("owner_wallet", ...).eq("resale_price", ...)` so a stale listing
 * (delisted, price changed, already bought) can't be claimed twice, and by
 * the unique constraint on tx_signature so one payment can't claim two
 * properties.
 */
export async function POST(req: Request) {
  let body: { propertyId?: unknown; wallet?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { propertyId, wallet, signature } = body;
  if (
    typeof propertyId !== "string" ||
    typeof wallet !== "string" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: property } = await db
    .from("properties")
    .select("id, owner_wallet, resale_price")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "unknown property" }, { status: 404 });
  }
  if (!property.resale_price || !property.owner_wallet) {
    return NextResponse.json({ error: "not listed for resale" }, { status: 409 });
  }
  if (property.owner_wallet === wallet) {
    return NextResponse.json({ error: "you already own this" }, { status: 409 });
  }

  let buyerPk: PublicKey;
  let sellerPk: PublicKey;
  try {
    buyerPk = new PublicKey(wallet);
    sellerPk = new PublicKey(property.owner_wallet);
  } catch {
    return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  }

  const tx = await conn.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || tx.meta?.err) {
    return NextResponse.json(
      { error: "transaction not found or failed" },
      { status: 422 },
    );
  }

  const mint = new PublicKey(CHIMP_MINT);
  const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk).toBase58();
  const sellerAta = getAssociatedTokenAddressSync(mint, sellerPk).toBase58();
  const astroAta = getAssociatedTokenAddressSync(
    mint,
    new PublicKey(ASTRO_CORP_WALLET),
  ).toBase58();

  const totalBase = BigInt(property.resale_price) * 10n ** BigInt(CHIMP_DECIMALS);
  const astroCut = (totalBase * FEE_PCT) / 100n;
  const sellerCut = totalBase - astroCut;

  const instructions = tx.transaction.message.instructions;
  function paidAtLeast(destination: string, amount: bigint): boolean {
    return instructions.some((ix) => {
      if (!("parsed" in ix) || ix.program !== "spl-token") return false;
      const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
      if (parsed.type !== "transfer" && parsed.type !== "transferChecked") return false;
      const info = parsed.info ?? {};
      if (info.destination !== destination || info.source !== buyerAta) return false;
      const raw = BigInt(
        (info.tokenAmount as { amount?: string } | undefined)?.amount ??
          (info.amount as string | undefined) ??
          "0",
      );
      return raw >= amount;
    });
  }

  if (!paidAtLeast(sellerAta, sellerCut) || !paidAtLeast(astroAta, astroCut)) {
    return NextResponse.json(
      { error: "payment split not found in that transaction" },
      { status: 422 },
    );
  }

  // Buyers can pay from a wallet that's never signed in - the deed is real
  // regardless of session state (same as the primary-sale claim route).
  await db.from("players").upsert(
    { wallet, handle: `chimp_${wallet.slice(0, 4)}${wallet.slice(-4)}` },
    { onConflict: "wallet", ignoreDuplicates: true },
  );

  const { data: updated, error: updErr } = await db
    .from("properties")
    .update({
      owner_wallet: wallet,
      tx_signature: signature,
      acquired_at: new Date().toISOString(),
      resale_price: null,
      resale_listed_at: null,
    })
    .eq("id", propertyId)
    .eq("owner_wallet", property.owner_wallet)
    .eq("resale_price", property.resale_price)
    .select("id, name, zone, type, price_chimp, owner_wallet, acquired_at")
    .maybeSingle();

  if (updErr) {
    // 23505 = unique_violation - this signature already claimed a property.
    if (updErr.code === "23505") {
      return NextResponse.json(
        { error: "this payment already claimed a property" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      {
        error:
          "the listing changed before your payment landed - your payment went through; contact support with the tx signature",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, property: updated });
}
