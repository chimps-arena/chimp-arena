import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { create as createCoreAsset, fetchCollection } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import bs58 from "bs58";
import { PUBLIC_ENV } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
import {
  ASTRO_CORP_WALLET,
  ASTROCHIMPS_COLLECTION,
  CHIMP_MINT,
  MILESTONE_MINT_INTERVAL,
  MINT_PRICE_BASE,
  TIER_ODDS,
  type ChimpTier,
} from "@/lib/chain/mint-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const endpoint =
  PUBLIC_ENV.solanaRpc ||
  clusterApiUrl(
    (PUBLIC_ENV.solanaCluster === "mainnet-beta"
      ? "mainnet-beta"
      : "devnet") as "mainnet-beta" | "devnet",
  );
const conn = new Connection(endpoint, "confirmed");

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Standard vs Rare only - One of One only ever comes from a milestone, see POST below. */
function rollTier(): Exclude<ChimpTier, "one_of_one"> {
  return Math.random() < TIER_ODDS.RARE ? "rare" : "standard";
}

/**
 * Picks a random One of One design for a milestone bonus. Reusable, not
 * claimed (founder's call, 2026-09-29): the catalog is only 5 designs and
 * hand-making a new one every 1000 mints forever isn't realistic, so the
 * same 5 shuffle and repeat indefinitely rather than running out. What
 * makes a milestone chimp special is that it's free and only comes once
 * every MILESTONE_MINT_INTERVAL mints, not that the design itself is
 * one-of-a-kind on-chain - two different wallets can both end up holding
 * a "The Founder". chimp_milestones (not chimp_variants) is the real
 * record of who got which design and when.
 */
async function pickOneOfOne(db: SupabaseClient): Promise<{ id: string; name: string } | null> {
  const { data: variants } = await db.from("chimp_variants").select("id, name");
  if (!variants || variants.length === 0) return null;
  return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * Standard/Rare art variety (migration 0016) - not scarce, so no claiming,
 * just a random pick among whichever styles actually have art uploaded.
 * Returns null (falls back to the old shared per-tier placeholder) until
 * at least one style in that tier has real art.
 */
async function pickStyleVariant(
  db: SupabaseClient,
  tier: "standard" | "rare",
): Promise<{ id: string; name: string } | null> {
  const { data: ready } = await db
    .from("chimp_style_variants")
    .select("id, name")
    .eq("tier", tier)
    .not("image_url", "is", null);
  if (!ready || ready.length === 0) return null;
  return ready[Math.floor(Math.random() * ready.length)];
}

/**
 * POST { wallet, signature } -> { ok, asset, signature, tier, name, milestone? }
 *
 * The buyer already sent the $CHIMP payment themselves (a plain transfer,
 * nothing privileged). This verifies that payment landed on-chain, draws a
 * Standard vs Rare tier (weighted random, same price regardless - see
 * rollTier), then mints via the mint delegate (see
 * /admin/collection-authority) into the Astrochimps collection. Both tiers
 * mint indefinitely - neither can sell out.
 *
 * One of One is deliberately NOT part of that random draw (founder's call,
 * 2026-09-27, after the 5% random chance and the milestone bonus below were
 * both drawing from the same small catalog and draining it too fast) - the
 * only way to get one is the milestone rule.
 *
 * Every mint gets a sequential number from chimp_mint_seq (Postgres
 * sequences are atomic, so concurrent mints near a milestone boundary can't
 * both land on the same number). Every MILESTONE_MINT_INTERVAL-th mint also
 * gets a second, free one-of-one minted to the same wallet - on top of, not
 * instead of, their paid tier. The 5 designs are reusable, not claimed
 * (founder's call, 2026-09-29 - see pickOneOfOne), so this never runs out;
 * it's just best-effort in the sense that a failed bonus mint doesn't fail
 * the paid mint it rides along with.
 *
 * The unique constraint on nft_mint_claims.tx_signature is claimed BEFORE
 * minting (not after) so two concurrent requests for the same payment can't
 * both mint - the loser gets a 409, not a free NFT. If minting itself then
 * fails, the claim is released so the same payment can be retried.
 */
export async function POST(req: Request) {
  let body: { wallet?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { wallet, signature } = body;
  if (typeof wallet !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!ASTROCHIMPS_COLLECTION) {
    return NextResponse.json({ error: "collection not configured" }, { status: 500 });
  }

  let buyerPk: PublicKey;
  try {
    buyerPk = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  }

  let tx;
  try {
    tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  if (!tx || tx.meta?.err) {
    return NextResponse.json(
      { error: "transaction not found or failed" },
      { status: 422 },
    );
  }

  const mint = new PublicKey(CHIMP_MINT);
  const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk).toBase58();
  const astroAta = getAssociatedTokenAddressSync(
    mint,
    new PublicKey(ASTRO_CORP_WALLET),
  ).toBase58();

  const paidEnough = tx.transaction.message.instructions.some((ix) => {
    if (!("parsed" in ix) || ix.program !== "spl-token") return false;
    const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
    if (parsed.type !== "transfer" && parsed.type !== "transferChecked") return false;
    const info = parsed.info ?? {};
    if (info.destination !== astroAta || info.source !== buyerAta) return false;
    const raw = BigInt(
      (info.tokenAmount as { amount?: string } | undefined)?.amount ??
        (info.amount as string | undefined) ??
        "0",
    );
    return raw >= MINT_PRICE_BASE;
  });
  if (!paidEnough) {
    return NextResponse.json(
      { error: "payment not found in that transaction" },
      { status: 422 },
    );
  }

  const db = supabaseAdmin();
  const { error: claimErr } = await db
    .from("nft_mint_claims")
    .insert({ tx_signature: signature, wallet, asset_address: "pending" });
  if (claimErr) {
    if (claimErr.code === "23505") {
      return NextResponse.json(
        { error: "this payment already minted an NFT" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }

  // A reliable sequential mint number - this is what the milestone check
  // reads, not a count(*) (which two mints landing at once could both see
  // as 999 and both think they're about to become the 1000th).
  const { data: mintNumber, error: seqErr } = await db.rpc("next_chimp_mint_number");
  if (seqErr || typeof mintNumber !== "number") {
    await db.from("nft_mint_claims").delete().eq("tx_signature", signature);
    return NextResponse.json({ error: "could not assign a mint number" }, { status: 500 });
  }

  const tier = rollTier();

  try {
    const umi = mintDelegateUmi();
    const collection = await fetchCollection(umi, umiPublicKey(ASTROCHIMPS_COLLECTION));
    const asset = generateSigner(umi);

    const style = await pickStyleVariant(db, tier);
    const name = style ? `${style.name} #${mintNumber}` : `Astrochimp #${mintNumber}`;
    const uri = style
      ? `${SITE_URL}/nft/chimp-metadata/style/${style.id}`
      : `${SITE_URL}/nft/chimp-metadata/tier/${tier}`;

    const mintTx = await createCoreAsset(umi, {
      asset,
      name,
      uri,
      collection,
      owner: umiPublicKey(wallet),
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

    const assetAddress = asset.publicKey.toString();
    await db
      .from("nft_mint_claims")
      .update({
        asset_address: assetAddress,
        tier,
        mint_number: mintNumber,
      })
      .eq("tx_signature", signature);

    const result: Record<string, unknown> = {
      ok: true,
      asset: assetAddress,
      signature: bs58.encode(mintTx.signature),
      tier,
      name,
    };

    // Best-effort bonus: the paid mint above already succeeded regardless of
    // what happens here, so a failure just means no milestone this time,
    // not a failed request. Nothing to release on failure since picking a
    // design no longer claims it - see pickOneOfOne.
    if (mintNumber % MILESTONE_MINT_INTERVAL === 0) {
      const bonusVariant = await pickOneOfOne(db);
      if (bonusVariant) {
        try {
          const bonusAsset = generateSigner(umi);
          const bonusTx = await createCoreAsset(umi, {
            asset: bonusAsset,
            name: bonusVariant.name,
            uri: `${SITE_URL}/nft/chimp-metadata/${bonusVariant.id}`,
            collection,
            owner: umiPublicKey(wallet),
          }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

          const bonusAddress = bonusAsset.publicKey.toString();
          await db.from("chimp_milestones").insert({
            mint_number: mintNumber,
            wallet,
            variant_id: bonusVariant.id,
            asset_address: bonusAddress,
          });

          result.milestone = {
            mintNumber,
            asset: bonusAddress,
            name: bonusVariant.name,
            signature: bs58.encode(bonusTx.signature),
          };
        } catch {
          // Bonus mint failed after the paid mint already succeeded - just
          // no milestone bonus this time, nothing to unwind.
        }
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    // Minting failed after the payment already landed - free up the claim so
    // the same payment signature can be retried instead of being stuck.
    await db.from("nft_mint_claims").delete().eq("tx_signature", signature);
    const msg = e instanceof Error ? e.message : "Mint failed after payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
