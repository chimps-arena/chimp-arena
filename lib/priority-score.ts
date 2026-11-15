/**
 * Priority User Score, Phase A (dev log #12): how likely a wallet is to be
 * a real, invested player, from signals that are on-chain and so hard to
 * fake - $CHIMP held and for how long, Astrochimps (and their tier) and
 * properties owned, and wallet age. Email (Phase B) and linked socials
 * (Phase C) add to the same score later. Server-only.
 *
 * Points and tiers were agreed with the founders on 2026-11-13.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchAssetsByOwner } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { chainEndpoint } from "@/lib/chain/connection";
import { ASTROCHIMPS_COLLECTION, CHIMP_MINT } from "@/lib/chain/mint-config";
import { PROPERTIES_COLLECTION } from "@/lib/chain/property-mint-config";
import { supabaseAdmin } from "@/lib/supabase/server";

export type PriorityTier = "none" | "bronze" | "silver" | "gold" | "platinum";

export const TIERS: { tier: Exclude<PriorityTier, "none">; label: string; min: number }[] = [
  { tier: "platinum", label: "Platinum", min: 250 },
  { tier: "gold", label: "Gold", min: 150 },
  { tier: "silver", label: "Silver", min: 75 },
  { tier: "bronze", label: "Bronze", min: 25 },
];

const DAY = 86_400_000;
// [threshold, points], highest first
const CHIMP_HELD: [number, number][] = [[10_000_000, 100], [1_000_000, 50], [100_000, 25], [10_000, 10]];
const HELD_DAYS: [number, number][] = [[90, 50], [30, 25], [7, 10]];
const WALLET_DAYS: [number, number][] = [[365, 30], [180, 15], [30, 5]];
const PER_CHIMP = 15;
const MAX_CHIMP_POINTS = 75;
const RARE_BONUS = 10;
const ONE_OF_ONE_BONUS = 50;
const PER_PROPERTY = 20;
const MAX_PROPERTY_POINTS = 100;
/** Holding time only counts once the wallet holds the first $CHIMP tier. */
const MIN_HOLD_FOR_TIME = CHIMP_HELD[CHIMP_HELD.length - 1][0];
/** Pages of 1,000 signatures to walk back looking for the oldest one. */
const MAX_SIGNATURE_PAGES = 5;

export const STALE_AFTER_MS = DAY;
export const RECHECK_COOLDOWN_MS = 10 * 60_000;

export interface PriorityBreakdown {
  chimpHeld: { amount: number; points: number };
  holdingDays: { days: number | null; points: number };
  astrochimps: { count: number; rare: number; oneOfOne: number; points: number };
  properties: { count: number; points: number };
  walletAgeDays: { days: number | null; points: number };
}

export interface PriorityScore {
  wallet: string;
  score: number;
  tier: PriorityTier;
  breakdown: PriorityBreakdown;
  checkedAt: string;
}

const step = (value: number, table: [number, number][]) => table.find(([min]) => value >= min)?.[1] ?? 0;

export function tierFor(score: number): PriorityTier {
  return TIERS.find((t) => score >= t.min)?.tier ?? "none";
}

/** Days since the oldest transaction touching `address`, walking back up
 *  to MAX_SIGNATURE_PAGES pages - for very busy accounts that's a lower
 *  bound, which only ever under-counts. Null if it has no history. */
async function ageInDays(conn: Connection, address: PublicKey): Promise<number | null> {
  let before: string | undefined;
  let oldest: number | null = null;
  for (let page = 0; page < MAX_SIGNATURE_PAGES; page++) {
    const sigs = await conn.getSignaturesForAddress(address, { before, limit: 1000 });
    if (sigs.length === 0) break;
    const last = sigs[sigs.length - 1];
    if (last.blockTime) oldest = last.blockTime;
    if (sigs.length < 1000) break;
    before = last.signature;
  }
  return oldest == null ? null : Math.floor((Date.now() - oldest * 1000) / DAY);
}

/** Works the score out fresh from chain (plus off-chain property deeds). */
export async function computePriorityScore(wallet: string): Promise<PriorityScore> {
  const conn = new Connection(chainEndpoint(), "confirmed");
  const owner = new PublicKey(wallet);
  const mint = new PublicKey(CHIMP_MINT);

  const [tokenAccounts, owned, walletAge, { data: deedRows }] = await Promise.all([
    conn.getParsedTokenAccountsByOwner(owner, { mint }),
    fetchAssetsByOwner(createUmi(chainEndpoint()), publicKey(wallet)),
    ageInDays(conn, owner),
    // Older properties are deeds in our own registry with no NFT behind them.
    supabaseAdmin().from("properties").select("id").eq("owner_wallet", wallet).is("asset_address", null),
  ]);

  const amount = tokenAccounts.value.reduce(
    (sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
    0,
  );
  const heldDays =
    amount >= MIN_HOLD_FOR_TIME ? await ageInDays(conn, getAssociatedTokenAddressSync(mint, owner)) : null;

  const inCollection = (a: (typeof owned)[number], collection: string) =>
    a.updateAuthority.type === "Collection" && a.updateAuthority.address?.toString() === collection;
  const chimps = owned.filter((a) => inCollection(a, ASTROCHIMPS_COLLECTION));
  // The metadata link says which tier an Astrochimp is: /style/rare-*,
  // /tier/rare, or a One of One's own /chimp-metadata/<variant>.
  const rare = chimps.filter((a) => /\/(style\/rare-|tier\/rare)/.test(a.uri)).length;
  const oneOfOne = chimps.filter(
    (a) => /\/tier\/one_of_one/.test(a.uri) || /\/chimp-metadata\/(?!style\/|tier\/)[^/]+$/.test(a.uri),
  ).length;
  const propertyCount =
    owned.filter((a) => inCollection(a, PROPERTIES_COLLECTION)).length + (deedRows?.length ?? 0);

  const breakdown: PriorityBreakdown = {
    chimpHeld: { amount, points: step(amount, CHIMP_HELD) },
    holdingDays: { days: heldDays, points: heldDays == null ? 0 : step(heldDays, HELD_DAYS) },
    astrochimps: {
      count: chimps.length,
      rare,
      oneOfOne,
      points:
        Math.min(chimps.length * PER_CHIMP, MAX_CHIMP_POINTS) +
        (rare > 0 ? RARE_BONUS : 0) +
        (oneOfOne > 0 ? ONE_OF_ONE_BONUS : 0),
    },
    properties: { count: propertyCount, points: Math.min(propertyCount * PER_PROPERTY, MAX_PROPERTY_POINTS) },
    walletAgeDays: { days: walletAge, points: walletAge == null ? 0 : step(walletAge, WALLET_DAYS) },
  };
  const score = Object.values(breakdown).reduce((s, b) => s + b.points, 0);
  return { wallet, score, tier: tierFor(score), breakdown, checkedAt: new Date().toISOString() };
}

export async function storedPriorityScore(wallet: string): Promise<PriorityScore | null> {
  const { data } = await supabaseAdmin()
    .from("priority_scores")
    .select("wallet, score, tier, breakdown, checked_at")
    .eq("wallet", wallet)
    .maybeSingle();
  return data
    ? { wallet: data.wallet, score: data.score, tier: data.tier, breakdown: data.breakdown, checkedAt: data.checked_at }
    : null;
}

export async function refreshPriorityScore(wallet: string): Promise<PriorityScore> {
  const fresh = await computePriorityScore(wallet);
  const { error } = await supabaseAdmin().from("priority_scores").upsert({
    wallet,
    score: fresh.score,
    tier: fresh.tier,
    breakdown: fresh.breakdown,
    checked_at: fresh.checkedAt,
  });
  if (error) throw new Error(`priority_scores upsert failed: ${error.message}`);
  return fresh;
}

/** One concrete thing that would add points, for the "next tier" hint. */
export function nextSteps(b: PriorityBreakdown): string[] {
  const out: string[] = [];
  const nextHold = [...CHIMP_HELD].reverse().find(([min]) => b.chimpHeld.amount < min);
  if (nextHold) out.push(`Hold ${nextHold[0].toLocaleString()} $CHIMP for +${nextHold[1] - b.chimpHeld.points}`);
  if (b.astrochimps.count * PER_CHIMP < MAX_CHIMP_POINTS) out.push(`Mint or buy an Astrochimp for +${PER_CHIMP}`);
  if (b.properties.count * PER_PROPERTY < MAX_PROPERTY_POINTS) out.push(`Own a property for +${PER_PROPERTY}`);
  if (b.chimpHeld.amount >= MIN_HOLD_FOR_TIME) {
    const nextDays = [...HELD_DAYS].reverse().find(([d]) => (b.holdingDays.days ?? 0) < d);
    if (nextDays) out.push(`Keep holding: ${nextDays[0]} days held earns ${nextDays[1]} points`);
  }
  return out.slice(0, 3);
}
