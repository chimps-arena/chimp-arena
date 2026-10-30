/**
 * Server-only. Moves a buyer-created asset into an official collection - the
 * second half of every buyer-pays sale (see app/api/mint/prepare and
 * app/api/land/prepare). The buyer's own transaction creates the asset with
 * the mint delegate recorded as its update authority; this is the
 * delegate's own separate transaction that then moves it in, which is what
 * makes the collection's locked 3% resale royalty apply to it.
 *
 * Two things the first version of this got wrong, both caught on-chain:
 * - Core only moves an asset when its CURRENT update authority signs, so
 *   the buyer's create must name the delegate as update authority. A
 *   buyer-held asset can't be moved by the delegate at all (error 0x1a).
 * - Passing the collection account alone is a silent no-op: the move only
 *   happens with newUpdateAuthority set to the collection explicitly.
 * So this verifies the asset's real on-chain state afterwards rather than
 * trusting that the call returned.
 */
import { fetchAsset, updateV2 } from "@metaplex-foundation/mpl-core";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";

async function isInCollection(assetAddress: string, collectionAddress: string): Promise<boolean> {
  const asset = await fetchAsset(mintDelegateUmi(), umiPublicKey(assetAddress));
  return asset.updateAuthority.type === "Collection" && asset.updateAuthority.address === collectionAddress;
}

/** Idempotent: an asset already in the collection returns true without
 *  sending anything. Retries transient failures; returns false (and logs)
 *  only if the asset genuinely isn't in the collection at the end. */
export async function moveIntoCollection(assetAddress: string, collectionAddress: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (await isInCollection(assetAddress, collectionAddress)) return true;
      const umi = mintDelegateUmi();
      await updateV2(umi, {
        asset: umiPublicKey(assetAddress),
        payer: umi.identity,
        authority: umi.identity,
        newCollection: umiPublicKey(collectionAddress),
        newUpdateAuthority: { __kind: "Collection", fields: [umiPublicKey(collectionAddress)] },
      }).sendAndConfirm(umi, { send: { maxRetries: 5 }, confirm: { commitment: "confirmed" } });
      if (await isInCollection(assetAddress, collectionAddress)) return true;
    } catch (e) {
      if (attempt === 2) {
        console.error("collection move failed after 3 attempts - needs a manual fix", { assetAddress, collectionAddress }, e);
        return false;
      }
    }
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  console.error("collection move did not take effect - needs a manual fix", { assetAddress, collectionAddress });
  return false;
}
