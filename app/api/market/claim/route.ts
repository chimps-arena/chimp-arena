import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PUBLIC_ENV } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ASTRO_CORP_WALLET, CHIMP_DECIMALS, CHIMP_MINT } from "@/lib/chain/market-config";

export const runtime = "nodejs";

const endpoint =
  PUBLIC_ENV.solanaRpc ||
  clusterApiUrl(
    (PUBLIC_ENV.solanaCluster === "mainnet-beta"
      ? "mainnet-beta"
      : "devnet") as "mainnet-beta" | "devnet",
  );
const conn = new Connection(endpoint, "confirmed");

/**
 * POST { propertyId, wallet, signature } -> { ok, property }
 *
 * Never trusts the client's word that it paid. Fetches the transaction by
 * signature and verifies it actually moved >= the listing price of $CHIMP
 * from `wallet` to the Astro Corp treasury account, THEN flips ownership -
 * guarded by `owner_wallet is null` (first valid claim wins) and a unique
 * constraint on tx_signature (one payment can never claim two properties).
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
    .select("id, price_chimp, owner_wallet, status, metadata_uri")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) {
    return NextResponse.json({ error: "unknown property" }, { status: 404 });
  }
  if (property.metadata_uri) {
    return NextResponse.json(
      { error: "this property is sold as an NFT now - use /api/land/claim instead" },
      { status: 409 },
    );
  }
  if (property.owner_wallet) {
    return NextResponse.json({ error: "already sold" }, { status: 409 });
  }
  if (property.status === "held") {
    return NextResponse.json(
      { error: "not released for sale yet" },
      { status: 409 },
    );
  }

  // ---- verify the payment on-chain ----
  let buyerPk: PublicKey;
  try {
    buyerPk = new PublicKey(wallet);
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

  const expectedDest = getAssociatedTokenAddressSync(
    new PublicKey(CHIMP_MINT),
    new PublicKey(ASTRO_CORP_WALLET),
  ).toBase58();
  const expectedSource = getAssociatedTokenAddressSync(
    new PublicKey(CHIMP_MINT),
    buyerPk,
  ).toBase58();
  const priceBase = BigInt(property.price_chimp) * 10n ** BigInt(CHIMP_DECIMALS);

  const instructions = tx.transaction.message.instructions;
  const paid = instructions.some((ix) => {
    if (!("parsed" in ix) || ix.program !== "spl-token") return false;
    const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
    if (parsed.type !== "transfer" && parsed.type !== "transferChecked") return false;
    const info = parsed.info ?? {};
    if (info.destination !== expectedDest || info.source !== expectedSource) return false;
    const amount = BigInt(
      (info.tokenAmount as { amount?: string } | undefined)?.amount ??
        (info.amount as string | undefined) ??
        "0",
    );
    return amount >= priceBase;
  });

  if (!paid) {
    return NextResponse.json(
      { error: "payment not found in that transaction" },
      { status: 422 },
    );
  }

  // Make sure this wallet has a players row (buyers can pay from a wallet
  // that's never signed in - the deed is real regardless of session state).
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
    })
    .eq("id", propertyId)
    .is("owner_wallet", null) // first valid claim wins
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
      { error: "already sold - your payment landed but this listing was taken first; contact support" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, property: updated });
}
