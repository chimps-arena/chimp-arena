/**
 * Astrochimp test-mint constants.
 *
 * MAINNET. Moving 1,000 real $CHIMP per mint. The payment + the NFT mint go
 * out as ONE transaction (see components/chimp-mint.tsx) so a failure can
 * never take the payment without delivering the NFT.
 */
import { PUBLIC_ENV } from "@/lib/env";
import { MINING } from "@/lib/game/sinks";

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
 * Rarity tiers (see migration 0014/0015). Every mint pays the same price;
 * Standard vs Rare is a weighted random draw (roll < RARE -> rare, else
 * standard), not something the buyer picks. One of One is NOT part of this
 * random draw - the only way to get one is the milestone rule below. The 5
 * chimp_variants designs are reusable and shuffled rather than a shrinking
 * catalog (founder's call, 2026-09-29): what makes a milestone chimp
 * special is that it's free and rare to land on, not that its design is
 * unique on-chain.
 */
export const TIER_ODDS = {
  RARE: 0.15,
} as const;

export type ChimpTier = "standard" | "rare" | "one_of_one";

/**
 * The founder's rule (2026-09-27): every Nth mint gets a second, bonus
 * one-of-one NFT minted to the same wallet for free, on top of whatever
 * tier their paid mint drew. Tracked via chimp_mint_seq / chimp_milestones
 * (migration 0014) so it survives concurrent mints landing near the
 * boundary at the same time.
 */
export const MILESTONE_MINT_INTERVAL = 1000;

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

/**
 * Handle (display name) changes (founder's rule, 2026-09-30, see migration
 * 0018 and PATCH /api/me): every player gets free renames for the first
 * RENAME_FREE_TRIAL_DAYS after their account is created. After that, a
 * rename costs RENAME_PRICE_CHIMP. Either way, a rename (free or paid)
 * starts a RENAME_COOLDOWN_DAYS lockout before the next one.
 */
export const RENAME_PRICE_CHIMP = 300;
export const RENAME_PRICE_BASE = BigInt(RENAME_PRICE_CHIMP) * 10n ** BigInt(CHIMP_DECIMALS);
export const RENAME_FREE_TRIAL_DAYS = 3;
export const RENAME_COOLDOWN_DAYS = 3;

export function renameMemo(wallet: string): string {
  return `ASTRORENAME:${wallet}`;
}

/**
 * Mining permit + tool prices in base units - same BigInt pattern as
 * RENAME_PRICE_BASE above, built from the whole-CHIMP numbers in
 * lib/game/sinks.ts's MINING block (don't use lib/game/economy.ts's
 * toBaseUnits() for this - it uses a stale CHIMP_DECIMALS=6, this file's
 * value of 9 is the one verified on-chain).
 */
export const MINING_PERMIT_PRICE_BASE =
  BigInt(MINING.permitPriceChimp) * 10n ** BigInt(CHIMP_DECIMALS);
