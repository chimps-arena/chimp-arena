import { NextResponse } from "next/server";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchAssetsByOwner } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolvePropertyImage } from "@/lib/chain/property-art";
import { chainEndpoint } from "@/lib/chain/connection";
import { ASTROCHIMPS_COLLECTION } from "@/lib/chain/mint-config";
import type { Property } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> { properties: Property[], nfts: { asset, name, image }[] }
 *
 * Properties come from our own DB (off-chain registry, owner_wallet is
 * authoritative). NFTs are read live from chain, not from nft_mint_claims -
 * that table only records who originally minted each one, not who owns it
 * now (a mint can be resold on any marketplace since it's a real on-chain
 * asset, outside our control). Filtered to the Astrochimps collection so a
 * wallet holding unrelated Core NFTs doesn't see those here too.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ properties: [], nfts: [] });
  }

  const db = supabaseAdmin();
  const { data: propRows } = await db
    .from("properties")
    .select(
      "id, name, zone, type, price_chimp, owner_wallet, acquired_at, blurb, status, resale_price, resale_listed_at, image_url, asset_address",
    )
    .eq("owner_wallet", session.wallet)
    .order("zone")
    .order("price_chimp");

  const properties: Property[] = (propRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    zone: p.zone,
    type: p.type,
    priceChimp: p.price_chimp,
    ownerWallet: p.owner_wallet,
    acquiredAt: p.acquired_at,
    blurb: p.blurb,
    status: p.status === "held" ? "held" : "listed",
    // New NFT properties carry their own Arweave art (image_url); only the
    // legacy off-chain-registry ones fall back to a local file by type.
    image: p.image_url ?? resolvePropertyImage(p.type),
    resalePrice: p.resale_price,
    resaleListedAt: p.resale_listed_at,
    assetAddress: p.asset_address,
  }));

  // Guest sessions and anything not a real Solana wallet can't own on-chain
  // NFTs - skip the chain lookup rather than let it fail on a bad address.
  let nfts: { asset: string; name: string; image: string }[] = [];
  const looksLikeWallet = !session.wallet.startsWith("guest_") && session.wallet.length >= 32;
  if (looksLikeWallet && ASTROCHIMPS_COLLECTION) {
    try {
      const umi = createUmi(chainEndpoint());
      const owned = await fetchAssetsByOwner(umi, publicKey(session.wallet));
      const inOurCollection = (a: (typeof owned)[number]) =>
        a.updateAuthority.type === "Collection" &&
        a.updateAuthority.address?.toString() === ASTROCHIMPS_COLLECTION;
      nfts = owned
        .filter((a) => a.name === "Astrochimp" || inOurCollection(a))
        .map((a) => ({
          asset: a.publicKey.toString(),
          name: a.name || "Astrochimp",
          image: "/characters/astrochimp-512.png",
          inCollection: inOurCollection(a),
        }));
    } catch {
      // RPC hiccup - show properties regardless, NFTs just come back empty.
    }
  }

  return NextResponse.json({ properties, nfts });
}
