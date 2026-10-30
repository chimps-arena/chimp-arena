import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { create as createCoreAsset } from "@metaplex-foundation/mpl-core";
import { createNoopSigner, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { addMemo, findAssociatedTokenPda, transferTokens } from "@metaplex-foundation/mpl-toolbox";
import { supabaseAdmin } from "@/lib/supabase/server";
import { chainEndpoint } from "@/lib/chain/connection";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
import { delegateHealth } from "@/lib/chain/delegate-health";
import { SimulationFailed, walletReadyTransaction } from "@/lib/chain/wallet-ready-tx";
import { ASTRO_CORP_WALLET, CHIMP_DECIMALS, CHIMP_MINT } from "@/lib/chain/mint-config";
import { PROPERTIES_COLLECTION, propertyMintMemo } from "@/lib/chain/property-mint-config";
import {
  assetExists,
  finalizePropertyPurchase,
  findCreationSignature,
  type PendingPropertyMint,
} from "@/lib/chain/property-purchase";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * POST { propertyId, wallet, asset } -> { transaction, blockhash, lastValidBlockHeight }
 *                              | { completed: true, asset, signature, warning? }
 *
 * The property-market twin of app/api/mint/prepare (read that route's
 * comments for the full reasoning): ONE transaction holding the $CHIMP
 * payment and the property NFT's creation, with the buyer as the only
 * wallet signer and fee payer - so the buyer pays the NFT's rent, not the
 * mint delegate. Returned unsigned: `asset` is the new NFT's address
 * keypair's public key, generated in the buyer's browser, which signs
 * after the wallet (Phantom's requirement - see app/api/mint/prepare and
 * lib/chain/wallet-ready-tx.ts). Confirm checks the NFT that landed is
 * exactly the one staged here. The delegate is only recorded as the asset's update
 * authority (a pubkey, not a signer), which is what lets app/api/land/confirm
 * move it into the Properties collection afterwards in the delegate's own
 * transaction - that move is what puts it under the locked 3% royalty.
 *
 * pending_property_mints locks the property to this one prepared
 * transaction until its blockhash expires (migration 0033), so two buyers
 * can never both hold a valid, payable transaction for the same property.
 * A lock is only released once its transaction can no longer land; if it
 * DID land (buyer paid, then closed the tab before confirm), it's finished
 * here instead of being handed to the next buyer.
 */
export async function POST(req: Request) {
  let body: { propertyId?: unknown; wallet?: unknown; asset?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { propertyId, wallet, asset: assetAddress } = body;
  if (typeof propertyId !== "string" || typeof wallet !== "string" || typeof assetAddress !== "string") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  try {
    new PublicKey(wallet);
    new PublicKey(assetAddress);
  } catch {
    return NextResponse.json({ error: "bad wallet or asset" }, { status: 400 });
  }
  if (!PROPERTIES_COLLECTION) {
    return NextResponse.json({ error: "properties collection not configured" }, { status: 500 });
  }

  // Refuse BEFORE the buyer pays if the delegate can't afford the
  // follow-up collection move.
  const health = await delegateHealth();
  if (!health.available) {
    return NextResponse.json(
      { error: "Property sales are temporarily unavailable - please try again shortly.", unavailable: true },
      { status: 503 },
    );
  }

  const db = supabaseAdmin();
  const { data: property } = await db
    .from("properties")
    .select("id, name, price_chimp, asset_address, metadata_uri, non_transferable")
    .eq("id", propertyId)
    .maybeSingle();
  // Same "live" gate as GET /api/land: art uploaded and not yet sold.
  if (!property || !property.metadata_uri) {
    return NextResponse.json({ error: "unknown property" }, { status: 404 });
  }
  if (property.asset_address) {
    return NextResponse.json({ error: "This property has already been sold." }, { status: 409 });
  }

  const conn = new Connection(chainEndpoint(), "confirmed");

  const { data: lock } = await db
    .from("pending_property_mints")
    .select("property_id, wallet, asset_address, last_valid_block_height")
    .eq("property_id", propertyId)
    .maybeSingle<PendingPropertyMint>();
  if (lock) {
    const height = await conn.getBlockHeight("confirmed");
    if (height <= lock.last_valid_block_height) {
      const mine = lock.wallet === wallet;
      return NextResponse.json(
        {
          error: mine
            ? "You already have a purchase of this property waiting - approve it in your wallet, or wait about a minute and try again."
            : "Someone else is buying this property right now - check back in a minute.",
        },
        { status: 409 },
      );
    }
    if (await assetExists(lock.asset_address)) {
      // The expired transaction landed - that buyer paid. Finish their
      // purchase rather than reselling the property.
      const signature = await findCreationSignature(lock.asset_address);
      const done = signature ? await finalizePropertyPurchase(db, lock, signature) : null;
      if (done?.ok && lock.wallet === wallet) {
        return NextResponse.json({ completed: true, ...done });
      }
      return NextResponse.json({ error: "This property has just been sold." }, { status: 409 });
    }
    await db
      .from("pending_property_mints")
      .delete()
      .eq("property_id", propertyId)
      .eq("asset_address", lock.asset_address);
  }

  try {
    const umi = mintDelegateUmi();
    const asset = createNoopSigner(umiPublicKey(assetAddress));
    const buyer = umiPublicKey(wallet);
    const buyerSigner = createNoopSigner(buyer);

    const mint = umiPublicKey(CHIMP_MINT);
    const buyerAta = findAssociatedTokenPda(umi, { mint, owner: buyer });
    const astroAta = findAssociatedTokenPda(umi, { mint, owner: umiPublicKey(ASTRO_CORP_WALLET) });
    const priceBase = BigInt(property.price_chimp) * 10n ** BigInt(CHIMP_DECIMALS);
    const bh = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });

    // Reserved properties (Founders Club, Devs Block, Marketing Station) are
    // frozen permanently at creation, authority locked to None - the plugin
    // can only be added at creation, and still allows the collection move
    // (verified by mainnet simulation, 2026-10-29).
    const plugins = property.non_transferable
      ? [{ type: "PermanentFreezeDelegate" as const, frozen: true, authority: { type: "None" as const } }]
      : undefined;

    const transaction = await walletReadyTransaction(
      umi,
      transferTokens(umi, {
        source: buyerAta,
        destination: astroAta,
        authority: buyerSigner,
        amount: priceBase,
      })
        .add(addMemo(umi, { memo: propertyMintMemo(propertyId, wallet) }))
        .add(
          createCoreAsset(umi, {
            asset,
            name: property.name,
            uri: property.metadata_uri ?? `${SITE_URL}/nft/property-metadata/${propertyId}`,
            owner: buyer,
            payer: buyerSigner,
            authority: buyerSigner,
            // See app/api/mint/prepare: the delegate must be the asset's
            // update authority to move it into the collection afterwards.
            updateAuthority: umi.identity.publicKey,
            plugins,
          }),
        )
        .setFeePayer(buyerSigner)
        .setBlockhash(bh),
    );

    const { error: lockErr } = await db.from("pending_property_mints").insert({
      property_id: propertyId,
      wallet,
      asset_address: assetAddress,
      last_valid_block_height: bh.lastValidBlockHeight,
    });
    if (lockErr) {
      return lockErr.code === "23505"
        ? NextResponse.json({ error: "Someone else is buying this property right now - check back in a minute." }, { status: 409 })
        : NextResponse.json({ error: "could not stage this purchase - try again" }, { status: 500 });
    }

    return NextResponse.json({
      transaction,
      blockhash: bh.blockhash,
      lastValidBlockHeight: bh.lastValidBlockHeight,
    });
  } catch (e) {
    if (e instanceof SimulationFailed) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("land prepare failed", { propertyId, wallet }, e);
    return NextResponse.json({ error: "could not prepare the purchase transaction" }, { status: 500 });
  }
}
