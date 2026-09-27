/**
 * One-off repair: every property's metadata_uri points at a permanently
 * uploaded JSON file, but all 100 of those files were uploaded by an older
 * version of upload-property-art.mjs that wrote `image: https://arweave.net/...`
 * into the JSON - a link that 404s until its Arweave bundle is mined, which
 * can take a long time. The DB's own image_url/metadata_uri columns were
 * patched to gateway.irys.xyz afterward, but that only fixed where the
 * pointer points TO, not what's baked inside the file it points at - Irys
 * uploads are immutable, so the already-uploaded JSON still has the dead
 * link (discovered 2026-09-27 via Devs Block I not rendering in Phantom).
 *
 * This re-uploads a corrected metadata JSON per property (reusing the
 * already-correct image_url - no need to re-upload the image itself, so
 * this is cheap) and repoints metadata_uri at it. For any property that's
 * already minted (asset_address set), it also sends a real on-chain update
 * so the live asset's uri actually changes, not just the DB - see
 * app/api/land/claim's mintDelegateUmi() equivalent below (this is a
 * standalone script, so it builds its own umi rather than importing the
 * Next.js lib).
 *
 * Usage: node --env-file=.env.local scripts/fix-property-metadata.mjs
 */
import bs58 from "bs58";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { createClient } from "@supabase/supabase-js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { update, fetchAsset, fetchCollection } from "@metaplex-foundation/mpl-core";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} - run with: node --env-file=.env.local scripts/fix-property-metadata.mjs`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const delegateSecret = requireEnv("MPL_CORE_MINT_DELEGATE_SECRET");
  const rpcUrl = requireEnv("NEXT_PUBLIC_SOLANA_RPC");
  const collectionAddress = requireEnv("NEXT_PUBLIC_PROPERTIES_COLLECTION");

  const db = createClient(supabaseUrl, serviceKey);
  const secretKey = bs58.decode(delegateSecret);

  const irys = await Uploader(Solana).withWallet(secretKey).withRpc(rpcUrl).mainnet();
  console.log("Irys balance:", irys.utils.fromAtomic(await irys.getLoadedBalance()).toString(), "SOL");

  const umi = createUmi(rpcUrl).use(mplToolbox());
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  umi.use(keypairIdentity(keypair));

  const { data: properties, error } = await db
    .from("properties")
    .select("id, name, zone, type, blurb, image_url, asset_address")
    .not("metadata_uri", "is", null);
  if (error) throw new Error(`fetch failed: ${error.message}`);

  const broken = properties.filter((p) => p.image_url);
  console.log(`Repairing metadata for ${broken.length} propert${broken.length === 1 ? "y" : "ies"}...`);

  // Fund Irys for this batch - small JSON files, but check rather than assume.
  const estimatedBytes = broken.length * 700;
  const price = await irys.getPrice(estimatedBytes);
  const loaded = await irys.getLoadedBalance();
  if (loaded.isLessThan(price)) {
    const topUp = price.minus(loaded).multipliedBy(1.1);
    console.log(`Funding Irys with ~${irys.utils.fromAtomic(topUp).toString()} SOL...`);
    await irys.fund(topUp.integerValue());
  }

  const mintedToFix = [];
  let fixed = 0;
  let failed = 0;

  for (const p of broken) {
    try {
      const metadata = {
        name: p.name,
        symbol: "ACHMPLAND",
        description: p.blurb ?? `A property deed in ${p.zone}, CHIMP Arena.`,
        image: p.image_url,
        external_url: "https://astrochimpz.com",
        attributes: [
          { trait_type: "Zone", value: p.zone },
          { trait_type: "Type", value: p.type },
        ],
        properties: {
          files: [{ uri: p.image_url, type: "image/png" }],
          category: "image",
        },
      };

      const receipt = await irys.upload(JSON.stringify(metadata), {
        tags: [
          { name: "Content-Type", value: "application/json" },
          { name: "App", value: "chimp-arena" },
          { name: "Property-Id", value: p.id },
        ],
      });
      const newUri = `https://gateway.irys.xyz/${receipt.id}`;

      const { error: updErr } = await db
        .from("properties")
        .update({ metadata_uri: newUri })
        .eq("id", p.id);
      if (updErr) throw new Error(`db update failed: ${updErr.message}`);

      console.log(`  ok  ${p.id.padEnd(28)} metadata=${receipt.id.slice(0, 12)}...`);
      fixed++;

      if (p.asset_address) mintedToFix.push({ id: p.id, name: p.name, assetAddress: p.asset_address, newUri });
    } catch (e) {
      console.error(`  FAIL ${p.id}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nMetadata repair: ${fixed} fixed, ${failed} failed.`);

  if (mintedToFix.length > 0) {
    console.log(`\n${mintedToFix.length} already-minted asset(s) need an on-chain update too:`);
    const collection = await fetchCollection(umi, umiPublicKey(collectionAddress));
    for (const m of mintedToFix) {
      try {
        const asset = await fetchAsset(umi, umiPublicKey(m.assetAddress));
        await update(umi, { asset, collection, uri: m.newUri }).sendAndConfirm(umi, {
          confirm: { commitment: "confirmed" },
        });
        console.log(`  ok  ${m.id} (${m.name}) - on-chain uri updated`);
      } catch (e) {
        console.error(`  FAIL on-chain update for ${m.id}: ${e.message}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
