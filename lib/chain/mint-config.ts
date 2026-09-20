/**
 * Astrochimp test-mint constants.
 *
 * MAINNET. Moving 1,000 real $CHIMP per mint. The payment + the NFT mint go
 * out as ONE transaction (see components/chimp-mint.tsx) so a failure can
 * never take the payment without delivering the NFT.
 */
import { PUBLIC_ENV } from "@/lib/env";

/** Live $CHIMP mint on mainnet. */
export const CHIMP_MINT =
  PUBLIC_ENV.chimpMint || "21ZDgkJ9ULqLoGyHMskAfwVwrx6oixWzxxENu59HHoBV";

/** $CHIMP has 9 decimals (verified on-chain). */
export const CHIMP_DECIMALS = 9;

/** Astro Corp revenue wallet - receives the mint payment. */
export const ASTRO_CORP_WALLET =
  PUBLIC_ENV.astroCorpWallet ||
  "2HJouoXc3KrWULcFqE2t1eQRY2EDjSTWL6KB3bhAQSPU";

/** Price of one Astrochimp, in whole $CHIMP (founders' note). */
export const MINT_PRICE_CHIMP = 1_000;

/** Price in base units (bigint). */
export const MINT_PRICE_BASE = BigInt(MINT_PRICE_CHIMP) * 10n ** BigInt(CHIMP_DECIMALS);

export const COLLECTION_NAME = "Astrochimps";
export const NFT_SYMBOL = "ACHMP";

/**
 * The Astrochimps collection - created once via /admin/create-collection.
 * Empty until that's run; new mints go in standalone (no royalty enforced)
 * until this is set. Update authority = the Astro Corp wallet (whoever signs
 * the creation transaction), per the founders' decision (2026-09-19).
 */
export const ASTROCHIMPS_COLLECTION = PUBLIC_ENV.astrochimpsCollection || "";

/**
 * Server-only keypair granted UpdateDelegate access on the collection (see
 * /admin/collection-authority), so /api/mint/claim can add new assets to it
 * without Astro Corp co-signing every mint. Public key only here - the
 * secret is loaded server-side via serverEnv().mintDelegateSecret.
 */
export const MINT_DELEGATE = PUBLIC_ENV.mintDelegate || "";

/** 3% resale royalty, enforced by marketplaces that respect Core (e.g. Tensor). */
export const ROYALTY_BASIS_POINTS = 300;

/**
 * Tags the $CHIMP payment so Astro Corp's wallet activity is
 * self-documenting - same idea as market-config.ts's deedMemo(). The asset
 * doesn't exist yet at payment time (it's created server-side after the
 * payment is verified, see app/api/mint/claim) - nft_mint_claims links this
 * payment's signature to the resulting asset address.
 */
export function mintMemo(wallet: string): string {
  return `ASTROMINT:${wallet}`;
}
