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
 */
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("properties")
    .select("id, name, zone, type, price_chimp, blurb, image_url, asset_address, non_transferable")
    .not("metadata_uri", "is", null)
    .is("asset_address", null)
    .order("zone")
    .order("price_chimp");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const properties: LandProperty[] = (data ?? []).map((p) => ({
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
