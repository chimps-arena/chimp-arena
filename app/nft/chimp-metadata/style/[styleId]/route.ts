import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { NFT_SYMBOL } from "@/lib/chain/mint-config";

export const runtime = "nodejs";

const TIER_LABEL: Record<string, string> = {
  standard: "Standard",
  rare: "Rare",
};

/**
 * Metaplex off-chain metadata for one Standard/Rare art variant (see
 * migration 0016). Unlike One of One, these aren't scarce - many mints
 * share the same style row - so there's no claiming here, just a lookup.
 * Falls back to /nft/chimp-metadata/tier/[tier] when a style has no art yet.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ styleId: string }> },
) {
  const { styleId } = await params;
  const origin = new URL(req.url).origin;

  const { data: style } = await supabaseAdmin()
    .from("chimp_style_variants")
    .select("name, tier, image_url")
    .eq("id", styleId)
    .maybeSingle();

  if (!style || !style.image_url) {
    return NextResponse.json({ error: "unknown or unready style" }, { status: 404 });
  }

  const label = TIER_LABEL[style.tier] ?? style.tier;

  return NextResponse.json(
    {
      name: style.name,
      symbol: NFT_SYMBOL,
      description: `An Astrochimp from the Astrochimpz mint (${label} tier).`,
      image: style.image_url,
      external_url: origin,
      attributes: [
        { trait_type: "Tier", value: label },
        { trait_type: "Style", value: style.name },
      ],
      properties: {
        files: [{ uri: style.image_url, type: "image/png" }],
        category: "image",
      },
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
