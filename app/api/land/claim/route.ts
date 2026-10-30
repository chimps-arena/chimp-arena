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
    .select("id, name, price_chimp, asset_address, metadata_uri, non_transferable")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "unknown property" }, { status: 404 });
  }
  if (property.asset_address) {
    return NextResponse.json({ error: "already sold" }, { status: 409 });
  }
  // New purchases go through app/api/land/prepare + confirm (buyer pays
  // rent); this route only remains to finish payments made under the old
  // flow. Never delegate-mint a property while a buyer-pays purchase of it
  // is in flight - both could land and the property would exist twice.
  const { data: lock } = await db
    .from("pending_property_mints")
    .select("property_id")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (lock) {
    return NextResponse.json(
      { error: "this property is mid-purchase - try again in a minute" },
      { status: 409 },
    );
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

    // Reserved properties (Founders Club, Devs Block, Marketing Station)
    // are frozen permanently at mint time, authority locked to None in the
    // same instruction - PermanentFreezeDelegate can only be added at
    // creation, never after, so this is the one chance to make it real
    // rather than just a display label.
    const plugins = property.non_transferable
      ? [{ type: "PermanentFreezeDelegate" as const, frozen: true, authority: { type: "None" as const } }]
      : undefined;

    const mintTx = await createCoreAsset(umi, {
      asset,
      name: property.name,
      uri,
      collection,
      owner: umiPublicKey(wallet),
      plugins,
    }).sendAndConfirm(umi, { send: { maxRetries: 5 }, confirm: { commitment: "confirmed" } });

    const assetAddress = asset.publicKey.toString();
    const mintSignature = bs58.encode(mintTx.signature);

    // From here on, the NFT is real and irreversible - a failure in the two
    // DB writes below must NEVER be treated the same as a failed mint (the
    // outer catch's "delete the claim, tell the buyer to retry" is only
    // correct for failures *before* this point). Getting that wrong is a
    // real bug this route had: a transient Supabase failure here used to
    // fall into the outer catch, which deleted the claim guard and
    // returned "minting failed" even though the asset already existed -
    // leaving properties.asset_address null so a second wallet could
    // legitimately buy (and mint a second real NFT for) the same listing.
    try {
      // Reserve the property atomically - if it's already sold (asset_address
      // set by a concurrent request), this update matches zero rows. Retried
      // a few times since this specific write is the one thing standing
      // between "sold" and "still looks available" - worth not giving up on
      // the first transient network blip.
      let updated: { id: string } | null = null;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 4 && !updated; attempt++) {
        try {
          const { data, error } = await db
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
          // supabase-js returns { data: null, error } on a query failure - it
          // does NOT throw, so this must be checked explicitly. Conflating a
          // real error with "zero rows matched" (a legitimate, error-less
          // outcome meaning someone else's claim already won) is exactly
          // what let the first mint of this kind go unrecorded while still
          // reporting success - the second request two days later had every
          // reason to believe the property was still available.
          if (error) throw error;
          updated = data;
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }

      if (lastErr) throw lastErr;

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
          signature: mintSignature,
          warning: "minted but the property row was already claimed - contact support",
        });
      }

      await db
        .from("property_mint_claims")
        .update({ asset_address: assetAddress })
        .eq("tx_signature", signature);

      return NextResponse.json({ ok: true, asset: assetAddress, signature: mintSignature });
    } catch (e) {
      // The mint is real and already belongs to the buyer - this is purely a
      // bookkeeping failure. Never delete the claim row here (that would
      // reopen the property to a second buyer) and never report this as a
      // failed mint to the client.
      console.error(
        "land claim: mint succeeded but recording it failed - needs a manual DB fix",
        { propertyId, wallet, signature, assetAddress },
        e,
      );
      return NextResponse.json({
        ok: true,
        asset: assetAddress,
        signature: mintSignature,
        warning:
          "minted successfully, but we couldn't record the sale due to a server error - contact support with this transaction signature so we can fix it manually",
      });
    }
  } catch (e) {
    await db.from("property_mint_claims").delete().eq("tx_signature", signature);
    // See app/api/mint/claim's identical catch block for why this doesn't
    // return the raw error - same mint delegate wallet, same failure class.
    console.error("land claim mint failed after payment", signature, e);
    const raw = e instanceof Error ? e.message : "Mint failed after payment";
    const msg = /insufficient funds for rent|insufficient lamports/i.test(raw)
      ? "Minting is temporarily unavailable (internal funding issue)."
      : "Minting failed unexpectedly.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
