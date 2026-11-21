import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolvePropertyImage } from "@/lib/chain/property-art";
import { fastImage } from "@/lib/nft-image";
import { PROPERTY_NFT_SYMBOL } from "@/lib/chain/property-mint-config";
import irysImages from "@/lib/property-nft-images.json";

/** Small WebP art on Irys per property (scripts/upload-property-thumbs.mjs). */
const IRYS_IMAGES: Record<string, string> = irysImages;

export const runtime = "nodejs";

/**
 * Metaplex off-chain metadata for one property NFT, which every property
 * NFT's on-chain uri points at. Each property has its own name/art, so
 * this is per-property.
 *
 * Properties used to point at Arweave JSON whose ~2.7 MB PNGs take ~11s
 * through the Irys gateway, and Phantom never showed them (dev log #13,
 * Nov 2026). This serves the same details with the art's small web copy
 * from our own CDN. Phantom still hid them, so the image is now that same
 * small copy stored on Irys - the host the Astrochimps that do show use -
 * rather than a chimp-arena.vercel.app URL. The Arweave originals are
 * untouched.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;
  const origin = new URL(req.url).origin;

  const { data: property } = await supabaseAdmin()
    .from("properties")
    .select("name, zone, type, blurb, image_url")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "unknown property" }, { status: 404 });
  }

  const art =
    IRYS_IMAGES[propertyId] ??
    (property.image_url ? fastImage(property.image_url) : resolvePropertyImage(property.type));
  const image = !art ? `${origin}/brand/chimp-logo.png` : art.startsWith("/") ? `${origin}${art}` : art;
  // Irys URLs have no extension; everything in IRYS_IMAGES is WebP.
  const type =
    IRYS_IMAGES[propertyId] || image.endsWith(".webp") ? "image/webp" : image.endsWith(".jpg") ? "image/jpeg" : "image/png";

  return NextResponse.json(
    {
      name: property.name,
      symbol: PROPERTY_NFT_SYMBOL,
      description:
        property.blurb ?? `A property deed in ${property.zone}, Astrochimpz.`,
      image,
      external_url: "https://astrochimpz.com",
      attributes: [
        { trait_type: "Zone", value: property.zone },
        { trait_type: "Type", value: property.type },
      ],
      properties: { files: [{ uri: image, type }], category: "image" },
    },
    { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } },
  );
}
