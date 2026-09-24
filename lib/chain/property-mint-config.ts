/**
 * Astrochimps Properties collection - the NFT relaunch of the property
 * market. Mirrors lib/chain/mint-config.ts exactly (same proven pattern:
 * collection created once, Royalties plugin locked to authority "None"
 * forever, a server-held delegate granted access to mint new members
 * without Astro Corp co-signing every purchase).
 *
 * Reuses the SAME mint delegate as Astrochimps (MPL_CORE_MINT_DELEGATE_SECRET)
 * rather than generating a second one - a delegate can be granted access to
 * multiple collections independently, and one wallet to fund/manage is
 * simpler than two.
 */
import { PUBLIC_ENV } from "@/lib/env";
import { ASTRO_CORP_WALLET, MINT_DELEGATE } from "@/lib/chain/mint-config";

export { ASTRO_CORP_WALLET, MINT_DELEGATE };

export const PROPERTY_COLLECTION_NAME = "Astrochimps Properties";
export const PROPERTY_NFT_SYMBOL = "ACHMPLAND";

/**
 * Empty until created via /admin/create-property-collection. New property
 * mints join this collection and carry the royalty once it's set.
 */
export const PROPERTIES_COLLECTION = PUBLIC_ENV.propertiesCollection || "";

/** 3% resale royalty - same rate as the primary property market and Astrochimps. */
export const PROPERTY_ROYALTY_BASIS_POINTS = 300;

/**
 * Tags the $CHIMP payment for a property mint so Astro Corp's wallet
 * activity is self-documenting - same idea as mintMemo() for Astrochimps.
 */
export function propertyMintMemo(propertyId: string, wallet: string): string {
  return `ASTROLAND:${propertyId}:${wallet}`;
}
