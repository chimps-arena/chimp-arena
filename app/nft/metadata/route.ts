import { NextResponse } from "next/server";
import { COLLECTION_NAME, NFT_SYMBOL } from "@/lib/chain/mint-config";

export const runtime = "nodejs";

/**
 * Metaplex off-chain metadata for an Astrochimp. Served from the app so the
 * URI is always absolute for whatever domain the mint runs on. Placeholder
 * art + copy — swap the image and description when final assets land.
 */
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      name: "Astrochimp",
      symbol: NFT_SYMBOL,
      description:
        "A test Astrochimp from the Astrochimpz mint. Placeholder art — the real character drops later.",
      image: `${origin}/nft/astrochimp.svg`,
      external_url: origin,
      attributes: [
        { trait_type: "Collection", value: COLLECTION_NAME },
        { trait_type: "Phase", value: "Test Mint" },
      ],
      properties: {
        files: [{ uri: `${origin}/nft/astrochimp.svg`, type: "image/svg+xml" }],
        category: "image",
      },
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
