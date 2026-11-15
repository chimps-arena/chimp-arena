// Points every property NFT's on-chain metadata link at our own fast
// /nft/property-metadata/<id> route instead of the slow Arweave JSON, so
// wallets like Phantom can load them (dev log #13). Signed by the mint
// delegate, which the property collection lists as an update delegate.
// Also stores the new link in properties.metadata_uri so later mints use it.
//
//   node --env-file=.env.local scripts/fix-property-uris.mjs --dry   # list only
//   node --env-file=.env.local scripts/fix-property-uris.mjs --one   # first one
//   node --env-file=.env.local scripts/fix-property-uris.mjs --all
//
// Safe to re-run: NFTs already pointing at the new link are skipped.
import bs58 from "bs58";
import { createClient } from "@supabase/supabase-js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { mplCore, fetchAssetV1, fetchCollectionV1, update } from "@metaplex-foundation/mpl-core";

// The same site address the Astrochimps' metadata links use.
const SITE = process.env.PROPERTY_METADATA_SITE ?? "https://chimp-arena.vercel.app";
const mode = process.argv[2];
if (!["--dry", "--one", "--all"].includes(mode)) throw new Error("pass --dry, --one or --all");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const umi = createUmi(process.env.NEXT_PUBLIC_SOLANA_RPC).use(mplCore());
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(bs58.decode(process.env.MPL_CORE_MINT_DELEGATE_SECRET))));
const collection = await fetchCollectionV1(umi, publicKey(process.env.NEXT_PUBLIC_PROPERTIES_COLLECTION));

const { data: props, error } = await db
  .from("properties")
  .select("id, name, asset_address, metadata_uri")
  .not("metadata_uri", "is", null)
  .order("id");
if (error) throw error;

let updated = 0;
for (const p of props) {
  const uri = `${SITE}/nft/property-metadata/${p.id}`;
  if (p.asset_address) {
    const asset = await fetchAssetV1(umi, publicKey(p.asset_address));
    if (asset.uri === uri) {
      console.log(`skip  ${p.id} (already done)`);
    } else if (mode === "--dry") {
      console.log(`would ${p.id}  ${asset.uri} -> ${uri}`);
    } else {
      // The new JSON must be live before the NFT points at it.
      const res = await fetch(uri);
      if (!res.ok) throw new Error(`${uri} returned ${res.status} - deploy the route first`);
      const { signature } = await update(umi, { asset, collection, uri }).sendAndConfirm(umi, {
        send: { maxRetries: 5 },
        confirm: { commitment: "confirmed" },
      });
      console.log(`done  ${p.id}  ${bs58.encode(signature)}`);
      updated++;
    }
  }
  if (mode !== "--dry" && p.metadata_uri !== uri) {
    const { error: e } = await db.from("properties").update({ metadata_uri: uri }).eq("id", p.id);
    if (e) throw e;
  }
  if (mode === "--one" && updated === 1) break;
}
console.log(`${mode}: ${updated} NFTs updated`);
