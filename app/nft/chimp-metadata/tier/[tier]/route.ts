import { NextResponse } from "next/server";
import { NFT_SYMBOL } from "@/lib/chain/mint-config";

export const runtime = "nodejs";

const TIER_LABEL: Record<string, string> = {
  standard: "Standard",
  rare: "Rare",
};

/**
 * Metaplex off-chain metadata shared by every Standard or Rare mint. Unlike
 * One of One (app/nft/chimp-metadata/[variantId]), these two tiers mint
 * indefinitely - there's no individual catalog row to point at, so every
 * Standard mint shares this one URI, and every Rare mint shares the other.
 * Placeholder art until real per-tier art lands (see app/mint/page.tsx).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tier: string }> },
) {
  const { tier } = await params;
  const label = TIER_LABEL[tier];
  if (!label) {
    return NextResponse.json({ error: "unknown tier" }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const image = `${origin}/characters/astrochimp-512.png`;

  return NextResponse.json(
    {
      name: `Astrochimp (${label})`,
      symbol: NFT_SYMBOL,
      description: `An Astrochimp from the Astrochimpz mint (${label} tier). Placeholder art — real per-tier art drops later.`,
      image,
      external_url: origin,
      attributes: [{ trait_type: "Tier", value: label }],
      properties: {
        files: [{ uri: image, type: "image/png" }],
        category: "image",
      },
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
