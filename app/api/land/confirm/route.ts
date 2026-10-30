import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { finalizePropertyPurchase, type PendingPropertyMint } from "@/lib/chain/property-purchase";

export const runtime = "nodejs";

/**
 * POST { propertyId, wallet, signature } -> { ok, asset, signature, warning? }
 *
 * Second half of a buyer-pays property purchase (see app/api/land/prepare).
 * The NFT already exists in the buyer's wallet by the time this runs - this
 * verifies the transaction on-chain, records the sale, and has the mint
 * delegate move the NFT into the Properties collection (its only cost: the
 * network fee). Safe to call repeatedly with the same signature.
 */
export async function POST(req: Request) {
  let body: { propertyId?: unknown; wallet?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { propertyId, wallet, signature } = body;
  if (typeof propertyId !== "string" || typeof wallet !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const db = supabaseAdmin();
  let pending: PendingPropertyMint | null = null;

  const { data: lock } = await db
    .from("pending_property_mints")
    .select("property_id, wallet, asset_address, last_valid_block_height")
    .eq("property_id", propertyId)
    .eq("wallet", wallet)
    .maybeSingle<PendingPropertyMint>();
  pending = lock;

  if (!pending) {
    // Already recorded by an earlier confirm (lock released) - rebuild the
    // same input from the audit trail so a retry can still finish the
    // collection move.
    const { data: claim } = await db
      .from("property_mint_claims")
      .select("property_id, wallet, asset_address")
      .eq("tx_signature", signature)
      .maybeSingle();
    if (!claim || claim.property_id !== propertyId || claim.wallet !== wallet || claim.asset_address === "pending") {
      return NextResponse.json({ error: "no pending purchase found for this property - start a new one" }, { status: 404 });
    }
    pending = { ...claim, last_valid_block_height: 0 };
  }

  const result = await finalizePropertyPurchase(db, pending, signature);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
