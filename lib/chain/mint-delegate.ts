/**
 * Server-only. Builds a umi instance signed by the mint delegate keypair
 * (see scripts/gen-mint-delegate.mjs, /admin/collection-authority) so
 * app/api/mint/claim can add new assets to the Astrochimps collection
 * without Astro Corp co-signing every mint.
 *
 * Never import this from a client component - serverEnv() throws outside a
 * server context, which is the point.
 */
import bs58 from "bs58";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity } from "@metaplex-foundation/umi";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { chainEndpoint } from "@/lib/chain/connection";
import { serverEnv } from "@/lib/env";

export function mintDelegateUmi() {
  const umi = createUmi(chainEndpoint()).use(mplToolbox());
  const secretKey = bs58.decode(serverEnv().mintDelegateSecret);
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  umi.use(keypairIdentity(keypair));
  return umi;
}
