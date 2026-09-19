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
 * Tags the $CHIMP payment so Astro Corp's wallet activity is
 * self-documenting - same idea as market-config.ts's deedMemo(). Includes
 * the minted asset's address so a specific mint can be traced to its payment.
 */
export function mintMemo(assetAddress: string, wallet: string): string {
  return `ASTROMINT:${assetAddress}:${wallet}`;
}
