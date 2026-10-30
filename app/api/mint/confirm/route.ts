import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { create as createCoreAsset, fetchCollection } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import bs58 from "bs58";
import { PUBLIC_ENV } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
import { moveIntoCollection } from "@/lib/chain/collection-join";
import { verifyCreatedAsset } from "@/lib/chain/verify-created-asset";
import {
  ASTRO_CORP_WALLET,
  ASTROCHIMPS_COLLECTION,
  CHIMP_MINT,
  MILESTONE_MINT_INTERVAL,
  MINT_PRICE_BASE,
} from "@/lib/chain/mint-config";

export const runtime = "nodejs";

const endpoint =
  PUBLIC_ENV.solanaRpc ||
  clusterApiUrl(
    (PUBLIC_ENV.solanaCluster === "mainnet-beta" ? "mainnet-beta" : "devnet") as "mainnet-beta" | "devnet",
  );
const conn = new Connection(endpoint, "confirmed");

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Picks a random One of One design for a milestone bonus. Unchanged from
 * the old app/api/mint/claim (now retired) - still delegate-paid and
 * best-effort, since it's rare (1 in MILESTONE_MINT_INTERVAL) and small
 * enough that moving its SOL cost onto the buyer isn't worth the
 * complexity of a second buyer-signed transaction for a "free" bonus.
 */
async function pickOneOfOne(
  db: ReturnType<typeof supabaseAdmin>,
): Promise<{ id: string; name: string; image_url: string | null } | null> {
  const { data: variants } = await db.from("chimp_variants").select("id, name, image_url");
  if (!variants || variants.length === 0) return null;
  return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * POST { wallet, signature } -> { ok, asset, signature, tier, name, imageUrl, milestone? }
 *
 * The main mint is already done by the time this is called - the buyer's
 * wallet signed and submitted the single combined transaction that
 * app/api/mint/prepare built (payment + NFT creation together, buyer pays
 * the real rent). This route only verifies that transaction actually landed
 * and matches what was staged in pending_chimp_mints, then records it and
 * rolls the milestone bonus - it performs no minting of its own for the
 * primary tier.
 *
 * tx_signature keeps the exact same unique-constraint replay-guard role it
 * always had (see nft_mint_claims, migration 0010) - a duplicate confirm
 * call for an already-recorded signature returns the existing result
 * instead of erroring, rather than attempting (and failing) a second
 * milestone roll for the same mint.
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

  const db = supabaseAdmin();

  const { data: pending } = await db
    .from("pending_chimp_mints")
    .select("asset_address, tier, mint_number, name, image_url, uri")
    .eq("wallet", wallet)
    .maybeSingle();

  if (!pending) {
    // Either already confirmed (check nft_mint_claims for an idempotent
    // retry) or genuinely never prepared.
    const { data: already } = await db
      .from("nft_mint_claims")
      .select("asset_address, tier, mint_number")
      .eq("tx_signature", signature)
      .maybeSingle();
    if (already) {
      return NextResponse.json({
        ok: true,
        asset: already.asset_address,
        signature,
        tier: already.tier,
        name: `#${already.mint_number}`,
      });
    }
    return NextResponse.json(
      { error: "no pending mint found for this wallet - start a new mint" },
      { status: 404 },
    );
  }

  let tx;
  try {
    tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  if (!tx || tx.meta?.err) {
    return NextResponse.json({ error: "transaction not found or failed" }, { status: 422 });
  }

  // The buyer's browser holds every key that signed this transaction, so
  // nothing in it is trusted: re-verify the real payment and the staged
  // asset both appear in it, then (below) that the NFT is the staged one.
  const mint = new PublicKey(CHIMP_MINT);
  const buyerPk = new PublicKey(wallet);
  const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk).toBase58();
  const astroAta = getAssociatedTokenAddressSync(mint, new PublicKey(ASTRO_CORP_WALLET)).toBase58();

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
  const assetCreated = tx.transaction.message.accountKeys.some(
    (k) => k.pubkey.toBase58() === pending.asset_address,
  );
  if (!paidEnough || !assetCreated) {
    return NextResponse.json(
      { error: "transaction doesn't match the staged mint - try again" },
      { status: 422 },
    );
  }
  // The asset keypair is generated in the buyer's browser (see
  // app/api/mint/prepare), so check the NFT itself is the one we staged -
  // name, art (uri), owner, and the delegate as update authority.
  const mismatch = await verifyCreatedAsset(pending.asset_address, {
    owner: wallet,
    name: pending.name,
    uri: pending.uri ?? null,
    collection: ASTROCHIMPS_COLLECTION,
  });
  if (mismatch) {
    console.error("mint confirm: created NFT doesn't match the staged mint", { wallet, signature, mismatch });
    return NextResponse.json({ error: `NFT doesn't match the staged mint (${mismatch})` }, { status: 422 });
  }

  const { error: claimErr } = await db.from("nft_mint_claims").insert({
    tx_signature: signature,
    wallet,
    asset_address: pending.asset_address,
    tier: pending.tier,
    mint_number: pending.mint_number,
  });
  if (claimErr) {
    if (claimErr.code === "23505") {
      // Already recorded by an earlier confirm call for this exact
      // signature - return the same result instead of double-rolling the
      // milestone bonus below.
      return NextResponse.json({
        ok: true,
        asset: pending.asset_address,
        signature,
        tier: pending.tier,
        name: pending.name,
        imageUrl: pending.image_url,
      });
    }
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }

  await db.from("pending_chimp_mints").delete().eq("wallet", wallet);

  // Every mint must land in the collection for the 3% resale royalty to
  // apply; failure never unwinds the mint (already final), it's surfaced
  // as a warning and logged for a manual fix (see /admin/status).
  const collectionJoined = await moveIntoCollection(pending.asset_address, ASTROCHIMPS_COLLECTION);

  const result: Record<string, unknown> = {
    ok: true,
    asset: pending.asset_address,
    signature,
    tier: pending.tier,
    name: pending.name,
    imageUrl: pending.image_url,
  };
  if (!collectionJoined) {
    // The NFT is real and the buyer's regardless - this only means it isn't
    // grouped under Astrochimps (and isn't covered by the 3% resale
    // royalty) until someone manually re-runs the collection-join step.
    result.warning =
      "Your Astrochimp is in your wallet. Adding it to the official collection didn't finish yet - Astro Corp will complete that, nothing more to pay.";
  }

  // Best-effort bonus, unchanged from the old claim route: the paid mint
  // above already succeeded regardless of what happens here, and it's still
  // delegate-paid (rare + small enough not to be worth a second buyer-signed
  // transaction).
  if (pending.mint_number % MILESTONE_MINT_INTERVAL === 0) {
    try {
      const umi = mintDelegateUmi();
      const collection = await fetchCollection(umi, umiPublicKey(ASTROCHIMPS_COLLECTION));
      const bonusVariant = await pickOneOfOne(db);
      if (bonusVariant) {
        const bonusAsset = generateSigner(umi);
        const bonusTx = await createCoreAsset(umi, {
          asset: bonusAsset,
          name: bonusVariant.name,
          uri: `${SITE_URL}/nft/chimp-metadata/${bonusVariant.id}`,
          collection,
          owner: umiPublicKey(wallet),
          // Explicit - an omitted authority becomes a non-signer placeholder.
          authority: umi.identity,
        }).sendAndConfirm(umi, { send: { maxRetries: 5 }, confirm: { commitment: "confirmed" } });

        const bonusAddress = bonusAsset.publicKey.toString();
        await db.from("chimp_milestones").insert({
          mint_number: pending.mint_number,
          wallet,
          variant_id: bonusVariant.id,
          asset_address: bonusAddress,
        });

        result.milestone = {
          mintNumber: pending.mint_number,
          asset: bonusAddress,
          name: bonusVariant.name,
          imageUrl: bonusVariant.image_url || "/characters/astrochimp-512.png",
          signature: bs58.encode(bonusTx.signature),
        };
      }
    } catch {
      // Bonus mint failed after the paid mint already succeeded - just no
      // milestone bonus this time, nothing to unwind.
    }
  }

  return NextResponse.json(result);
}
