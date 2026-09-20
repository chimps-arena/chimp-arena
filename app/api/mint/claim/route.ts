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
  MINT_PRICE_BASE,
} from "@/lib/chain/mint-config";

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

/**
 * POST { wallet, signature } -> { ok, asset, signature }
 *
 * The buyer already sent the $CHIMP payment themselves (a plain transfer,
 * nothing privileged). This verifies that payment actually landed on-chain,
 * then uses the mint delegate (see /admin/collection-authority) to create
 * the NFT inside the Astrochimps collection, owned by the buyer - the same
 * verify-then-act pattern as /api/market/resale/claim, just minting instead
 * of transferring an existing row.
 *
 * The unique constraint on nft_mint_claims.tx_signature is claimed BEFORE
 * minting (not after) so two concurrent requests for the same payment can't
 * both mint - the loser gets a 409, not a free NFT. If minting itself then
 * fails, the placeholder row is removed so the same payment can be retried.
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

  try {
    const umi = mintDelegateUmi();
    const collection = await fetchCollection(umi, umiPublicKey(ASTROCHIMPS_COLLECTION));
    const asset = generateSigner(umi);

    const mintTx = await createCoreAsset(umi, {
      asset,
      name: "Astrochimp",
      uri: `${SITE_URL}/nft/metadata`,
      collection,
      owner: umiPublicKey(wallet),
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

    const assetAddress = asset.publicKey.toString();
    await db
      .from("nft_mint_claims")
      .update({ asset_address: assetAddress })
      .eq("tx_signature", signature);

    return NextResponse.json({
      ok: true,
      asset: assetAddress,
      signature: bs58.encode(mintTx.signature),
    });
  } catch (e) {
    // Minting failed after the payment already landed - free up the claim so
    // the same payment signature can be retried instead of being stuck.
    await db.from("nft_mint_claims").delete().eq("tx_signature", signature);
    const msg = e instanceof Error ? e.message : "Mint failed after payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
