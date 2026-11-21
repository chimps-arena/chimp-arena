import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolvePropertyImage } from "@/lib/chain/property-art";
import { fastImage } from "@/lib/nft-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface WorldProperty {
  id: string;
  name: string;
  zone: string;
  type: string;
  priceChimp: number;
  /** Small local copy of the property's NFT art (or its type's photo). */
  image: string | null;
  ownerHandle: string | null;
  /** Unsold, or listed for resale by its owner. */
  forSale: boolean;
}

/**
 * GET -> { properties: WorldProperty[] }
 *
 * Every property-market property, for placing buildings in the 3D world.
 * Public information only (names, prices, owners' public handles) - the same
 * things the market page already shows.
 */
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("properties")
    .select("id, name, zone, type, price_chimp, owner_wallet, status, resale_price, image_url, metadata_uri")
    .order("zone")
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const wallets = [...new Set((data ?? []).map((p) => p.owner_wallet).filter(Boolean))] as string[];
  const handles = new Map<string, string>();
  if (wallets.length) {
    const { data: players } = await db.from("players").select("wallet, handle").in("wallet", wallets);
    for (const p of players ?? []) handles.set(p.wallet, p.handle);
  }

  const properties: WorldProperty[] = (data ?? []).map((p) => {
    const listed = p.status === "listed" && p.resale_price != null;
    return {
      id: p.id,
      name: p.name,
      zone: p.zone,
      type: p.type,
      priceChimp: listed ? p.resale_price : p.price_chimp,
      image: p.image_url ? fastImage(p.image_url) : resolvePropertyImage(p.type),
      ownerHandle: p.owner_wallet ? (handles.get(p.owner_wallet) ?? "a holder") : null,
      forSale: !p.owner_wallet || listed,
    };
  });

  return NextResponse.json({ properties }, { headers: { "cache-control": "public, max-age=30" } });
}
