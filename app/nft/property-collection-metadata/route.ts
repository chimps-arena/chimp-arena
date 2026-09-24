import { NextResponse } from "next/server";
import { PROPERTY_COLLECTION_NAME, PROPERTY_NFT_SYMBOL } from "@/lib/chain/property-mint-config";

export const runtime = "nodejs";

/** Off-chain metadata for the Astrochimps Properties collection itself (not a single NFT). */
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      name: PROPERTY_COLLECTION_NAME,
      symbol: PROPERTY_NFT_SYMBOL,
      description:
        "Property deeds in the CHIMP Arena universe. 3% resale royalty to Astro Corp on every trade.",
      image: `${origin}/brand/chimp-logo.png`,
      external_url: origin,
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
