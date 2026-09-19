import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolvePropertyImage } from "@/lib/chain/property-art";
import type { Property } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("properties")
    .select(
      "id, name, zone, type, price_chimp, owner_wallet, acquired_at, blurb, status, resale_price, resale_listed_at",
    )
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
