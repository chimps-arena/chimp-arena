import { NextResponse } from "next/server";
import { COLLECTION_NAME, NFT_SYMBOL } from "@/lib/chain/mint-config";

export const runtime = "nodejs";

/** Off-chain metadata for the Astrochimps collection itself (not a single NFT). */
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      name: COLLECTION_NAME,
      symbol: NFT_SYMBOL,
      description:
        "Astrochimp NFTs minted in the CHIMP Arena. 3% resale royalty to Astro Corp on every trade.",
      image: `${origin}/brand/chimp-logo.png`,
      external_url: origin,
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
