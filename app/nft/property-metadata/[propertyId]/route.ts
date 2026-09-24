import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolvePropertyImage } from "@/lib/chain/property-art";
import { PROPERTY_NFT_SYMBOL } from "@/lib/chain/property-mint-config";

export const runtime = "nodejs";

/**
 * Metaplex off-chain metadata for one property NFT. Unlike Astrochimps
 * (one shared metadata URI for every mint, since they're all identical),
 * each property has its own name/art, so this is per-property and baked
 * into the URI at mint time - see app/api/land/claim.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;
  const origin = new URL(req.url).origin;

  const { data: property } = await supabaseAdmin()
    .from("properties")
    .select("name, zone, type, blurb")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "unknown property" }, { status: 404 });
  }

  const image = resolvePropertyImage(property.type);

  return NextResponse.json(
    {
      name: property.name,
      symbol: PROPERTY_NFT_SYMBOL,
      description:
        property.blurb ?? `A property deed in ${property.zone}, CHIMP Arena.`,
      image: image ? `${origin}${image}` : `${origin}/brand/chimp-logo.png`,
      external_url: origin,
      attributes: [
        { trait_type: "Zone", value: property.zone },
        { trait_type: "Type", value: property.type },
      ],
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
