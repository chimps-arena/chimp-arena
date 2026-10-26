import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { create as createCoreAsset, fetchCollection } from "@metaplex-foundation/mpl-core";
import { createNoopSigner, generateSigner, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { addMemo, findAssociatedTokenPda, transferTokens } from "@metaplex-foundation/mpl-toolbox";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
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
 * POST { wallet } -> { transaction, tier, name, imageUrl, mintNumber }
 *
 * Builds ONE transaction containing both the $CHIMP payment and the NFT
 * creation, with the buyer's own wallet as fee payer for the whole thing -
 * they cover their own mint's real SOL rent instead of the mint delegate
 * (see migration 0031). The buyer isn't available to sign server-side, so a
 * createNoopSigner stands in for their pubkey while building; the delegate
 * (to authorize joining the collection) and the brand-new asset keypair (a
 * new account must sign its own creation) sign here, leaving the buyer's
 * slot an all-zero placeholder for their wallet to fill in client-side (see
 * components/chimp-mint.tsx). Because the delegate signs over the FULL,
 * final message, the buyer's wallet cannot alter a single instruction
 * (amount, destination, asset) without invalidating that signature and
 * making the whole transaction fail outright - so this is strictly safer
 * than trusting a client-reported payment, not weaker.
 *
 * Tier/style/mint-number are rolled here (not at confirm time) because
 * they're baked into the asset's on-chain name/uri before the buyer ever
 * signs - this does mean an abandoned prepare (wallet popup dismissed)
 * burns a real mint number, a wider gap-tolerance than before, accepted as
 * the tradeoff (sequence numbers only need to be unique and increasing, see
 * next_chimp_mint_number's own comments, not dense).
 */
export async function POST(req: Request) {
  let body: { wallet?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { wallet } = body;
  if (typeof wallet !== "string") {
    return NextResponse.json({ error: "missing wallet" }, { status: 400 });
  }
  if (!ASTROCHIMPS_COLLECTION) {
    return NextResponse.json({ error: "collection not configured" }, { status: 500 });
  }

  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "bad wallet" }, { status: 400 });
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
    const collection = await fetchCollection(umi, umiPublicKey(ASTROCHIMPS_COLLECTION));
    const asset = generateSigner(umi);
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
        collection,
        owner: buyer,
        payer: buyerSigner,
        // Explicit, not relied-on-by-omission: when authority isn't passed,
        // the generated instruction just drops it to a non-signer
        // placeholder (verified directly in the installed SDK) rather than
        // defaulting to the delegate - the OLD code only worked because the
        // delegate happened to also be the fee payer back then. Now that
        // the buyer is fee payer, the delegate must be named here or it's
        // simply not a required signer at all (reproduced locally - this
        // exact omission is what broke the first real test mint attempt).
        authority: umi.identity,
      }),
    );

    builder = builder.setFeePayer(buyerSigner).setBlockhash(bh);

    let tx = builder.build(umi);
    tx = await asset.signTransaction(tx);
    tx = await umi.identity.signTransaction(tx);

    const serialized = Buffer.from(toWeb3JsTransaction(tx).serialize()).toString("base64");

    const { error: pendingErr } = await db.from("pending_chimp_mints").insert({
      wallet,
      asset_address: asset.publicKey.toString(),
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
    console.error("mint prepare failed", wallet, e);
    return NextResponse.json({ error: "could not prepare the mint transaction" }, { status: 500 });
  }
}
