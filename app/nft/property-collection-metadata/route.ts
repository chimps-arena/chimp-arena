import { NextResponse } from "next/server";
import { PROPERTY_COLLECTION_NAME, PROPERTY_NFT_SYMBOL } from "@/lib/chain/property-mint-config";

export const runtime = "nodejs";

/**
 * Collection art, on Irys like the rest of the NFT images. It must differ
 * from the Astrochimps collection's logo: wallets treat a collection that
 * reuses a known collection's image as a copycat and hide it (dev log #13).
 * Founders Club II's art until the founders' collection artwork is uploaded.
 */
const COLLECTION_IMAGE = "https://gateway.irys.xyz/4LWh1aNbMt4i9ajvjeMw2NBzvD3Zs674iugipjnxbw9w";

/** Off-chain metadata for the properties collection itself (not a single NFT). */
export function GET() {
  return NextResponse.json(
    {
      name: PROPERTY_COLLECTION_NAME,
      symbol: PROPERTY_NFT_SYMBOL,
      description:
        "Property deeds in Astroworld, the Astrochimpz universe. 3% resale royalty to Astro Corp on every trade.",
      image: COLLECTION_IMAGE,
      external_url: "https://astrochimpz.com",
      properties: { files: [{ uri: COLLECTION_IMAGE, type: "image/webp" }], category: "image" },
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
