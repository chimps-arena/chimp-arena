/**
 * Server-only. Since the new NFT's address keypair is generated in the
 * buyer's browser (lib/chain/wallet-signs-first.ts), a tampering buyer
 * could in principle create the asset with a different name/art/authority
 * than the one we staged. Confirm routes call this before recording a sale:
 * the asset on-chain must be exactly what prepare staged.
 */
import { fetchAsset } from "@metaplex-foundation/mpl-core";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
import { MINT_DELEGATE } from "@/lib/chain/mint-config";

export async function verifyCreatedAsset(
  assetAddress: string,
  expected: { owner: string; name: string; uri: string | null; collection: string; frozen?: boolean },
): Promise<string | null> {
  let asset;
  try {
    asset = await fetchAsset(mintDelegateUmi(), umiPublicKey(assetAddress));
  } catch {
    return "the NFT wasn't found on-chain";
  }
  const ua = asset.updateAuthority;
  const uaOk =
    (ua.type === "Address" && ua.address === MINT_DELEGATE) ||
    (ua.type === "Collection" && ua.address === expected.collection);
  if (asset.owner !== expected.owner) return "NFT owner doesn't match";
  if (asset.name !== expected.name) return "NFT name doesn't match";
  if (expected.uri !== null && asset.uri !== expected.uri) return "NFT metadata doesn't match";
  if (!uaOk) return "NFT update authority doesn't match";
  if (expected.frozen) {
    const freeze = asset.permanentFreezeDelegate;
    if (!freeze?.frozen || freeze.authority.type !== "None") return "NFT isn't permanently frozen";
  }
  return null;
}
