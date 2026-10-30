/**
 * Server-only. Finishing a buyer-pays property purchase (see
 * app/api/land/prepare): verify the buyer's transaction really landed and
 * paid, record the sale, then move the NFT into the Properties collection
 * so the collection's locked 3% royalty covers every resale.
 *
 * Shared by app/api/land/confirm (the normal path) and app/api/land/prepare
 * (which finishes a purchase whose buyer closed the tab after paying but
 * before confirm ran, instead of handing the property to someone else).
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { chainEndpoint } from "@/lib/chain/connection";
import { ASTRO_CORP_WALLET, CHIMP_DECIMALS, CHIMP_MINT } from "@/lib/chain/mint-config";
import { PROPERTIES_COLLECTION } from "@/lib/chain/property-mint-config";
import { moveIntoCollection } from "@/lib/chain/collection-join";
import { verifyCreatedAsset } from "@/lib/chain/verify-created-asset";
import type { supabaseAdmin } from "@/lib/supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;

export interface PendingPropertyMint {
  property_id: string;
  wallet: string;
  asset_address: string;
  last_valid_block_height: number;
}

export type FinalizeResult =
  | { ok: true; asset: string; signature: string; warning?: string }
  | { ok: false; status: number; error: string };

const conn = () => new Connection(chainEndpoint(), "confirmed");

/** The transaction that created this asset - its earliest successful one.
 *  null if the asset doesn't exist (yet). */
export async function findCreationSignature(assetAddress: string): Promise<string | null> {
  const sigs = await conn().getSignaturesForAddress(new PublicKey(assetAddress), { limit: 20 });
  const ok = sigs.filter((s) => !s.err);
  return ok.length ? ok[ok.length - 1].signature : null;
}

export async function assetExists(assetAddress: string): Promise<boolean> {
  return (await conn().getAccountInfo(new PublicKey(assetAddress))) !== null;
}

export async function finalizePropertyPurchase(
  db: Db,
  pending: PendingPropertyMint,
  signature: string,
): Promise<FinalizeResult> {
  const { property_id: propertyId, wallet, asset_address: assetAddress } = pending;

  const { data: property } = await db
    .from("properties")
    .select("name, price_chimp, asset_address, metadata_uri, non_transferable")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) return { ok: false, status: 404, error: "unknown property" };

  let tx;
  try {
    tx = await conn().getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  } catch {
    return { ok: false, status: 400, error: "bad signature" };
  }
  if (!tx || tx.meta?.err) {
    return { ok: false, status: 422, error: "transaction not found or failed" };
  }

  // The buyer's browser holds every key that signed this transaction
  // (app/api/land/prepare), so nothing in it is trusted: the payment went
  // buyer -> Astro Corp for at least the price, this transaction touched
  // the staged asset, and (below) the NFT itself is the staged one.
  const mint = new PublicKey(CHIMP_MINT);
  const buyerAta = getAssociatedTokenAddressSync(mint, new PublicKey(wallet)).toBase58();
  const astroAta = getAssociatedTokenAddressSync(mint, new PublicKey(ASTRO_CORP_WALLET)).toBase58();
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
  const assetCreated = tx.transaction.message.accountKeys.some((k) => k.pubkey.toBase58() === assetAddress);
  if (!paidEnough || !assetCreated) {
    return { ok: false, status: 422, error: "transaction doesn't match the staged purchase" };
  }
  const mismatch = await verifyCreatedAsset(assetAddress, {
    owner: wallet,
    name: property.name,
    uri: property.metadata_uri,
    collection: PROPERTIES_COLLECTION,
    frozen: property.non_transferable,
  });
  if (mismatch) {
    console.error("land confirm: created NFT doesn't match the staged purchase", { propertyId, signature, mismatch });
    return { ok: false, status: 422, error: `NFT doesn't match the staged purchase (${mismatch})` };
  }

  // Replay guard + audit trail. A duplicate means an earlier confirm already
  // recorded it - fall through so a retry can still finish the collection
  // move, which is idempotent.
  const { error: claimErr } = await db
    .from("property_mint_claims")
    .insert({ tx_signature: signature, wallet, property_id: propertyId, asset_address: assetAddress });
  if (claimErr && claimErr.code !== "23505") {
    console.error("land confirm: recording the claim failed", { propertyId, signature }, claimErr);
    return { ok: false, status: 500, error: "could not record the purchase - retry, nothing will be charged again" };
  }

  let warning: string | undefined;
  if (property.asset_address !== assetAddress) {
    // The property lock means nothing else should ever have sold this
    // property meanwhile, but keep the guard: never overwrite a recorded sale.
    const { data: updated, error } = await db
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
    if (error) {
      console.error("land confirm: recording the sale failed", { propertyId, signature }, error);
      return { ok: false, status: 500, error: "could not record the purchase - retry, nothing will be charged again" };
    }
    if (!updated) {
      console.error("land confirm: property already recorded as sold to another asset - needs a manual fix", {
        propertyId,
        wallet,
        signature,
        assetAddress,
      });
      warning = "Your property NFT is in your wallet, but the sale needs a manual check - contact support with this transaction.";
    }
  }

  await db.from("pending_property_mints").delete().eq("property_id", propertyId);

  if (!(await moveIntoCollection(assetAddress, PROPERTIES_COLLECTION))) {
    warning ??=
      "Your property is in your wallet. Adding it to the official collection didn't finish yet - Astro Corp will complete that, nothing more to pay.";
  }

  return { ok: true, asset: assetAddress, signature, ...(warning ? { warning } : {}) };
}
