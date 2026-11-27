import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { LandProperty } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> { properties: LandProperty[] }
 *
 * The new-system storefront: properties that actually have art uploaded
 * (metadata_uri set - see scripts/upload-property-art.mjs) and haven't been
 * minted yet (asset_address still null). A property with a price but no art
 * yet, or already sold, doesn't show up here - same "live" gate the upload
 * script itself uses.
 *
 * Belt and braces: a property with a verified, paid claim is hidden too,
 * even if recording the sale on the property itself failed (Nov 26: a
 * Ledger buyer's sale couldn't be recorded, so a bought property stayed
 * listed). The claim row is written before the property row, so it's the
 * earliest proof that someone paid.
 */
export async function GET() {
  const db = supabaseAdmin();
  const [{ data, error }, { data: claims, error: claimsError }] = await Promise.all([
    db
      .from("properties")
      .select("id, name, zone, type, price_chimp, blurb, image_url, asset_address, non_transferable")
      .not("metadata_uri", "is", null)
      .is("asset_address", null)
      .order("zone")
      .order("price_chimp"),
    db.from("property_mint_claims").select("property_id").neq("asset_address", "pending"),
  ]);

  if (error || claimsError) {
    return NextResponse.json({ error: (error ?? claimsError)!.message }, { status: 500 });
  }

  const paid = new Set((claims ?? []).map((c) => c.property_id as string));
  const properties: LandProperty[] = (data ?? []).filter((p) => !paid.has(p.id)).map((p) => ({
    id: p.id,
    name: p.name,
    zone: p.zone,
    type: p.type,
    priceChimp: p.price_chimp,
    blurb: p.blurb,
    imageUrl: p.image_url,
    assetAddress: p.asset_address,
    nonTransferable: p.non_transferable,
  }));

  return NextResponse.json({ properties });
}
