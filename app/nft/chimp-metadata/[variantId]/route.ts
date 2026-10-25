import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { NFT_SYMBOL } from "@/lib/chain/mint-config";

export const runtime = "nodejs";

const TIER_LABEL: Record<string, string> = {
  standard: "Standard",
  rare: "Rare",
  one_of_one: "One of One",
};

/**
 * Metaplex off-chain metadata for one drawn Astrochimp variant. Unlike the
 * old shared /nft/metadata (every mint identical), each variant has its own
 * tier and eventually its own art - see app/api/mint/claim, which draws a
 * variant and bakes this URI into the mint. image_url is null until real
 * per-tier art is uploaded (migration 0014/0015), so this falls back to the
 * one existing pose in the meantime, same as property-metadata did before
 * property art landed.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ variantId: string }> },
) {
  const { variantId } = await params;
  const origin = new URL(req.url).origin;

  const { data: variant } = await supabaseAdmin()
    .from("chimp_variants")
    .select("name, tier, blurb, image_url, mime_type")
    .eq("id", variantId)
    .maybeSingle();

  if (!variant) {
    return NextResponse.json({ error: "unknown variant" }, { status: 404 });
  }

  const image = variant.image_url ?? `${origin}/characters/astrochimp-512.png`;
  // The static fallback above is a real PNG regardless of this row's
  // mime_type - only trust the DB's mime_type when actually serving its own image_url.
  const imageType = variant.image_url ? variant.mime_type || "image/png" : "image/png";

  return NextResponse.json(
    {
      name: variant.name,
      symbol: NFT_SYMBOL,
      description:
        variant.blurb ??
        `An Astrochimp from the Astrochimpz mint (${TIER_LABEL[variant.tier] ?? variant.tier} tier).`,
      image,
      external_url: origin,
      attributes: [
        { trait_type: "Tier", value: TIER_LABEL[variant.tier] ?? variant.tier },
      ],
      properties: {
        files: [{ uri: image, type: imageType }],
        category: "image",
      },
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
