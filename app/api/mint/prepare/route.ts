import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { create as createCoreAsset } from "@metaplex-foundation/mpl-core";
import { createNoopSigner, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { addMemo, findAssociatedTokenPda, transferTokens } from "@metaplex-foundation/mpl-toolbox";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
import { delegateHealth } from "@/lib/chain/delegate-health";
import { SimulationFailed, walletReadyTransaction } from "@/lib/chain/wallet-ready-tx";
import {
  ASTRO_CORP_WALLET,
  ASTROCHIMPS_COLLECTION,
  CHIMP_MINT,
  MINT_PRICE_BASE,
  TIER_ODDS,
  mintMemo,
  type ChimpTier,
} from "@/lib/chain/mint-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Roughly matches how long a Solana blockhash stays valid - a pending
 *  prepare older than this is assumed abandoned (wallet popup dismissed, tab
 *  closed) and is safe to replace rather than block a genuine retry on. */
const PENDING_TTL_MS = 90_000;

const TIER_PLACEHOLDER_IMAGE: Record<"standard" | "rare", string> = {
  standard: "/characters/astrochimp-512.png",
  rare: "/characters/astrochimp-512.png",
};

function rollTier(): Exclude<ChimpTier, "one_of_one"> {
  return Math.random() < TIER_ODDS.RARE ? "rare" : "standard";
}

/** Same draw as app/api/mint/claim - no claiming, just a random pick among
 *  whichever Standard/Rare styles actually have art uploaded. */
async function pickStyleVariant(
  db: SupabaseClient,
  tier: "standard" | "rare",
): Promise<{ id: string; name: string; image_url: string } | null> {
  const { data: ready } = await db
    .from("chimp_style_variants")
    .select("id, name, image_url")
    .eq("tier", tier)
    .eq("retired", false)
    .not("image_url", "is", null);
  if (!ready || ready.length === 0) return null;
  return ready[Math.floor(Math.random() * ready.length)];
}

/**
 * POST { wallet, asset } -> { transaction, tier, name, imageUrl, mintNumber }
 *
 * Builds ONE transaction containing both the $CHIMP payment and the NFT
 * creation, paid for by the buyer's own wallet - they cover their own
 * mint's SOL rent instead of the mint delegate (see migration 0031).
 *
 * Returned completely UNSIGNED. `asset` is the public key of the new NFT's
 * address keypair, generated in the buyer's browser: the buyer's wallet
 * signs first, then the browser adds that keypair's signature
 * (lib/chain/wallet-signs-first.ts). Phantom's documented requirement for
 * transactions it can simulate - when this route signed with the asset
 * keypair server-side, Phantom showed no balance changes and flagged the
 * site as possibly malicious (2026-10-26 to 10-30). It's also simulated
 * here first with an explicit compute limit (lib/chain/wallet-ready-tx.ts).
 *
 * The delegate never signs anything here; it's only recorded as the NFT's
 * update authority so app/api/mint/confirm can move it into the collection
 * in the delegate's own separate transaction. Because the buyer's browser
 * holds the asset keypair, confirm checks the NFT that landed matches what
 * was staged here (lib/chain/verify-created-asset.ts).
 *
 * Tier/style/mint-number are rolled here (not at confirm time) because
 * they're baked into the asset's on-chain name/uri before the buyer ever
 * signs - this does mean an abandoned prepare (wallet popup dismissed)
 * burns a real mint number, a wider gap-tolerance than before, accepted as
 * the tradeoff (sequence numbers only need to be unique and increasing, see
 * next_chimp_mint_number's own comments, not dense).
 */
export async function POST(req: Request) {
  let body: { wallet?: unknown; asset?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { wallet, asset: assetAddress } = body;
  if (typeof wallet !== "string" || typeof assetAddress !== "string") {
    return NextResponse.json({ error: "missing wallet or asset" }, { status: 400 });
  }
  if (!ASTROCHIMPS_COLLECTION) {
    return NextResponse.json({ error: "collection not configured" }, { status: 500 });
  }

  try {
    new PublicKey(wallet);
    new PublicKey(assetAddress);
  } catch {
    return NextResponse.json({ error: "bad wallet or asset" }, { status: 400 });
  }

  // Refuse BEFORE the buyer pays if the delegate can't afford its own
  // follow-up transaction (the collection move in app/api/mint/confirm).
  const health = await delegateHealth();
  if (!health.available) {
    return NextResponse.json(
      { error: "Minting is temporarily unavailable - please try again shortly.", unavailable: true },
      { status: 503 },
    );
  }

  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("pending_chimp_mints")
    .select("created_at")
    .eq("wallet", wallet)
    .maybeSingle();
  if (existing) {
    const age = Date.now() - new Date(existing.created_at).getTime();
    if (age < PENDING_TTL_MS) {
      return NextResponse.json(
        {
          error:
            "a mint is already in progress for this wallet - check your wallet for a pending approval, or wait a moment and try again",
        },
        { status: 409 },
      );
    }
    await db.from("pending_chimp_mints").delete().eq("wallet", wallet);
  }

  const { data: mintNumber, error: seqErr } = await db.rpc("next_chimp_mint_number");
  if (seqErr || typeof mintNumber !== "number") {
    return NextResponse.json({ error: "could not assign a mint number" }, { status: 500 });
  }

  const tier = rollTier();

  try {
    const umi = mintDelegateUmi();
    const asset = createNoopSigner(umiPublicKey(assetAddress));
    const buyer = umiPublicKey(wallet);
    const buyerSigner = createNoopSigner(buyer);

    const style = await pickStyleVariant(db, tier);
    const name = style ? `${style.name} #${mintNumber}` : `Astrochimp #${mintNumber}`;
    const uri = style
      ? `${SITE_URL}/nft/chimp-metadata/style/${style.id}`
      : `${SITE_URL}/nft/chimp-metadata/tier/${tier}`;
    const imageUrl = style?.image_url || TIER_PLACEHOLDER_IMAGE[tier];

    const mint = umiPublicKey(CHIMP_MINT);
    const buyerAta = findAssociatedTokenPda(umi, { mint, owner: buyer });
    const astroAta = findAssociatedTokenPda(umi, { mint, owner: umiPublicKey(ASTRO_CORP_WALLET) });
    const bh = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });

    let builder = transferTokens(umi, {
      source: buyerAta,
      destination: astroAta,
      authority: buyerSigner,
      amount: MINT_PRICE_BASE,
    }).add(addMemo(umi, { memo: mintMemo(wallet) }));

    builder = builder.add(
      createCoreAsset(umi, {
        asset,
        name,
        uri,
        // No collection yet, but the delegate is recorded as update
        // authority (just a pubkey, not a signer here) - Core only lets an
        // asset's CURRENT update authority move it into a collection, so
        // without this app/api/mint/confirm's move fails with 0x1a and the
        // NFT never joins Astrochimps (what happened to #54-#63,
        // 2026-10-29). Phantom's warning persisted with and without this
        // field, so it was never the cause.
        updateAuthority: umi.identity.publicKey,
        owner: buyer,
        payer: buyerSigner,
        authority: buyerSigner,
      }),
    );

    const serialized = await walletReadyTransaction(umi, builder.setFeePayer(buyerSigner).setBlockhash(bh));

    const { error: pendingErr } = await db.from("pending_chimp_mints").insert({
      wallet,
      asset_address: assetAddress,
      uri,
      tier,
      mint_number: mintNumber,
      name,
      image_url: imageUrl,
    });
    if (pendingErr) {
      const status = pendingErr.code === "23505" ? 409 : 500;
      const message =
        pendingErr.code === "23505"
          ? "a mint is already in progress for this wallet - try again in a moment"
          : "could not stage this mint - try again";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      transaction: serialized,
      blockhash: bh.blockhash,
      lastValidBlockHeight: bh.lastValidBlockHeight,
      tier,
      name,
      imageUrl,
      mintNumber,
    });
  } catch (e) {
    if (e instanceof SimulationFailed) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("mint prepare failed", wallet, e);
    return NextResponse.json({ error: "could not prepare the mint transaction" }, { status: 500 });
  }
}
