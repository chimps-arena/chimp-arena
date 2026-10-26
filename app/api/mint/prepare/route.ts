import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { create as createCoreAsset } from "@metaplex-foundation/mpl-core";
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
 * creation, with the buyer's own wallet as the ONLY signer - they cover
 * their own mint's real SOL rent instead of the mint delegate (see
 * migration 0031). The buyer isn't available to sign server-side, so a
 * createNoopSigner stands in for their pubkey while building; the brand-new
 * asset keypair (a new account must sign its own creation - the same
 * ordinary pattern every Solana NFT mint already uses) signs here, leaving
 * the buyer's slot an all-zero placeholder for their wallet to fill in
 * client-side (see components/chimp-mint.tsx).
 *
 * Deliberately does NOT join the Astrochimps collection here, and does NOT
 * have the mint delegate co-sign at all (first version of this route did -
 * see git history) - a transaction arriving pre-signed by a second,
 * unrecognized wallet is exactly the shape Phantom's Blowfish scanner flags
 * as a likely drainer pattern, and it did, on the very first real test mint
 * (2026-10-26). The asset is created standalone instead, with its
 * updateAuthority set to the delegate's pubkey (not a required signer here,
 * just who's recorded as allowed to update it later) - app/api/mint/confirm
 * then moves it into the collection afterward in the delegate's OWN
 * separate transaction, which the buyer never sees or signs, so there's
 * nothing left for a wallet scanner to flag.
 *
 * Because the delegate's recorded updateAuthority is what the LATER
 * collection-join step checks against, not anything in this transaction,
 * the buyer's wallet still can't alter the amount, destination, or which
 * asset gets created without invalidating the asset keypair's own
 * signature and making the whole thing fail outright.
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
        // No collection, and deliberately no updateAuthority override
        // either - the buyer ends up fully owning and controlling a
        // perfectly ordinary standalone asset, nothing handed to anyone
        // else. The delegate still moves it into the Astrochimps
        // collection afterward (app/api/mint/confirm's own transaction),
        // but that permission comes from the collection's own
        // UpdateDelegate plugin (see components/collection-authority.tsx -
        // MINT_DELEGATE is an additionalDelegate ON THE COLLECTION), not
        // from anything recorded on this individual asset. An earlier
        // version of this route did set updateAuthority to the delegate,
        // which - on top of being unnecessary - is exactly the kind of
        // "this new NFT's control was handed to a stranger" pattern wallet
        // scanners (Phantom/Blowfish) are built to flag as a likely scam,
        // and did (2026-10-26, escalating from a soft warning to a hard
        // block on repeated attempts).
        owner: buyer,
        payer: buyerSigner,
        authority: buyerSigner,
      }),
    );

    builder = builder.setFeePayer(buyerSigner).setBlockhash(bh);

    let tx = builder.build(umi);
    tx = await asset.signTransaction(tx);

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
