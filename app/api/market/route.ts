import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolvePropertyImage } from "@/lib/chain/property-art";
import type { Property } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Exclude anything that's part of the new NFT property system (see
  // app/api/land) - a handful of these IDs were intentionally reused when
  // the new 100 were seeded (scripts/property-manifest.json), overwriting
  // the row in place. metadata_uri is only ever set by the new upload
  // pipeline, so it's the reliable marker either way. Without this, the two
  // systems' listings collide and this page's own (old, non-minting) buy
  // flow would try to "sell" something it can't actually deliver.
  const { data, error } = await supabaseAdmin()
    .from("properties")
    .select(
      "id, name, zone, type, price_chimp, owner_wallet, acquired_at, blurb, status, resale_price, resale_listed_at",
    )
    .is("metadata_uri", null)
    .order("zone")
    .order("price_chimp");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const properties: Property[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    zone: p.zone,
    type: p.type,
    priceChimp: p.price_chimp,
    ownerWallet: p.owner_wallet,
    acquiredAt: p.acquired_at,
    blurb: p.blurb,
    status: p.status === "held" ? "held" : "listed",
    image: resolvePropertyImage(p.type),
    resalePrice: p.resale_price,
    resaleListedAt: p.resale_listed_at,
  }));

  return NextResponse.json({ properties });
}
