import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { create as createCoreAsset, fetchCollection } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import bs58 from "bs58";
import { PUBLIC_ENV } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
import { ASTRO_CORP_WALLET, CHIMP_MINT, CHIMP_DECIMALS } from "@/lib/chain/mint-config";
import { PROPERTIES_COLLECTION } from "@/lib/chain/property-mint-config";

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
 * POST { propertyId, wallet, signature } -> { ok, asset, signature }
 *
 * Same verify-then-mint pattern as /api/mint/claim: the buyer sends the
 * $CHIMP payment themselves (a plain transfer, nothing privileged), this
 * verifies it landed on-chain, then uses the mint delegate (see
 * /admin/property-collection-authority) to create the property NFT inside
 * the Properties collection, owned by the buyer.
 *
 * property_mint_claims.tx_signature is claimed BEFORE minting so two
 * concurrent requests for the same payment can't both mint - the loser gets
 * a clean 409. If minting fails after the claim, the row is removed so the
 * same payment can be retried. properties.asset_address (unique, nullable)
 * stops the same property being sold twice even under a race.
 */
export async function POST(req: Request) {
  let body: { propertyId?: unknown; wallet?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { propertyId, wallet, signature } = body;
  if (
    typeof propertyId !== "string" ||
    typeof wallet !== "string" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (!PROPERTIES_COLLECTION) {
    return NextResponse.json({ error: "properties collection not configured" }, { status: 500 });
  }

  const db = supabaseAdmin();
  const { data: property } = await db
    .from("properties")
    .select("id, name, price_chimp, asset_address, metadata_uri")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "unknown property" }, { status: 404 });
  }
  if (property.asset_address) {
    return NextResponse.json({ error: "already sold" }, { status: 409 });
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
  const priceBase = BigInt(property.price_chimp) * 10n ** BigInt(CHIMP_DECIMALS);

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
    return raw >= priceBase;
  });
  if (!paidEnough) {
    return NextResponse.json(
      { error: "payment not found in that transaction" },
      { status: 422 },
    );
  }

  const { error: claimErr } = await db
    .from("property_mint_claims")
    .insert({ tx_signature: signature, wallet, property_id: propertyId, asset_address: "pending" });
  if (claimErr) {
    if (claimErr.code === "23505") {
      return NextResponse.json(
        { error: "this payment already claimed a property" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }

  try {
    const umi = mintDelegateUmi();
    const collection = await fetchCollection(umi, umiPublicKey(PROPERTIES_COLLECTION));
    const asset = generateSigner(umi);

    // Permanent Arweave metadata once uploaded (see
    // scripts/upload-property-art.mjs); falls back to our own dynamic route
    // for properties minted before their art existed.
    const uri = property.metadata_uri ?? `${SITE_URL}/nft/property-metadata/${propertyId}`;

    const mintTx = await createCoreAsset(umi, {
      asset,
      name: property.name,
      uri,
      collection,
      owner: umiPublicKey(wallet),
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

    const assetAddress = asset.publicKey.toString();

    // Reserve the property atomically - if it's already sold (asset_address
    // set by a concurrent request), this update matches zero rows.
    const { data: updated } = await db
      .from("properties")
      .update({
        owner_wallet: wallet,
        asset_address: assetAddress,
        tx_signature: signature,
        acquired_at: new Date().toISOString(),
      })
      .eq("id", propertyId)
      .is("asset_address", null)
      .select("id")
      .maybeSingle();

    if (!updated) {
      // Lost the race after minting - the NFT exists and belongs to this
      // buyer regardless, just not reflected in our index. Not a payment
      // loss; flag for a manual DB fix rather than losing the mint record.
      await db
        .from("property_mint_claims")
        .update({ asset_address: assetAddress })
        .eq("tx_signature", signature);
      return NextResponse.json({
        ok: true,
        asset: assetAddress,
        signature: bs58.encode(mintTx.signature),
        warning: "minted but the property row was already claimed - contact support",
      });
    }

    await db
      .from("property_mint_claims")
      .update({ asset_address: assetAddress })
      .eq("tx_signature", signature);

    return NextResponse.json({
      ok: true,
      asset: assetAddress,
      signature: bs58.encode(mintTx.signature),
    });
  } catch (e) {
    await db.from("property_mint_claims").delete().eq("tx_signature", signature);
    const msg = e instanceof Error ? e.message : "Mint failed after payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
