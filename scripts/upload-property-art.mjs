/**
 * Uploads property art + metadata to Arweave (permanent - no dependency on
 * our own domain staying alive, unlike the dynamic /nft/property-metadata
 * route this replaces) and upserts each property into Supabase with its
 * resulting metadata_uri.
 *
 * Reuses the same mint-delegate wallet already funded for Astrochimps/
 * property minting (MPL_CORE_MINT_DELEGATE_SECRET) to pay Arweave's
 * one-time storage fee - one server wallet for all "we pay a small amount
 * to make something permanent" costs.
 *
 * Usage:
 *   1. Fill in `price_chimp` and `image` (a local file path) for each entry
 *      in scripts/property-manifest.json that's ready to go live. Entries
 *      still missing either are skipped, not errored - fill in the rest
 *      later and re-run.
 *   2. node --env-file=.env.local scripts/upload-property-art.mjs
 *
 * Safe to re-run: properties that already have a metadata_uri in the DB
 * are skipped unless --force is passed.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import bs58 from "bs58";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { createClient } from "@supabase/supabase-js";

const MANIFEST_PATH = fileURLToPath(new URL("./property-manifest.json", import.meta.url));
const FORCE = process.argv.includes("--force");

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} - run with: node --env-file=.env.local scripts/upload-property-art.mjs`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const delegateSecret = requireEnv("MPL_CORE_MINT_DELEGATE_SECRET");
  const rpcUrl = requireEnv("NEXT_PUBLIC_SOLANA_RPC");

  const db = createClient(supabaseUrl, serviceKey);
  const secretKey = bs58.decode(delegateSecret);

  const irys = await Uploader(Solana).withWallet(secretKey).withRpc(rpcUrl).mainnet();
  console.log("Irys node address:", irys.address);
  const balance = await irys.getLoadedBalance();
  console.log("Irys balance:", irys.utils.fromAtomic(balance).toString(), "SOL");

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const ready = manifest.filter((p) => p.price_chimp != null && p.image);
  const notReady = manifest.length - ready.length;
  if (notReady > 0) {
    console.log(`Skipping ${notReady} propert${notReady === 1 ? "y" : "ies"} still missing price_chimp or image.`);
  }
  if (ready.length === 0) {
    console.log("Nothing ready to upload yet - fill in price_chimp and image in scripts/property-manifest.json.");
    return;
  }

  if (!FORCE) {
    const { data: already } = await db
      .from("properties")
      .select("id")
      .in("id", ready.map((p) => p.id))
      .not("metadata_uri", "is", null);
    const skip = new Set((already ?? []).map((r) => r.id));
    if (skip.size > 0) {
      console.log(`Skipping ${skip.size} already-uploaded (pass --force to redo): ${[...skip].join(", ")}`);
    }
    for (let i = ready.length - 1; i >= 0; i--) {
      if (skip.has(ready[i].id)) ready.splice(i, 1);
    }
  }

  // Irys needs its own prepaid balance, separate from the wallet's SOL -
  // fund it here rather than making this a manual pre-step someone forgets.
  const estimatedBytes = ready.reduce((sum, p) => {
    try {
      return sum + statSync(p.image).size + 1024; // +1KB for the metadata JSON
    } catch {
      return sum;
    }
  }, 0);
  const price = await irys.getPrice(estimatedBytes);
  const loaded = await irys.getLoadedBalance();
  if (loaded.isLessThan(price)) {
    const topUp = price.minus(loaded).multipliedBy(1.1); // 10% buffer
    console.log(`Funding Irys with ~${irys.utils.fromAtomic(topUp).toString()} SOL to cover this batch...`);
    await irys.fund(topUp.integerValue());
  }

  console.log(`Uploading ${ready.length} propert${ready.length === 1 ? "y" : "ies"}...`);

  let uploaded = 0;
  let failed = 0;
  for (const p of ready) {
    try {
      if (!existsSync(p.image)) {
        throw new Error(`image file not found: ${p.image}`);
      }
      const ext = extname(p.image).toLowerCase();
      const contentType = MIME_TYPES[ext];
      if (!contentType) {
        throw new Error(`unrecognized image extension: ${ext}`);
      }

      const imageReceipt = await irys.uploadFile(p.image, {
        tags: [
          { name: "Content-Type", value: contentType },
          { name: "App", value: "chimp-arena" },
          { name: "Property-Id", value: p.id },
        ],
      });
      const imageUri = `https://arweave.net/${imageReceipt.id}`;

      const metadata = {
        name: p.name,
        symbol: "ACHMPLAND",
        description: p.blurb ?? `A property deed in ${p.zone}, CHIMP Arena.`,
        image: imageUri,
        external_url: "https://astrochimpz.com",
        attributes: [
          { trait_type: "Zone", value: p.zone },
          { trait_type: "Type", value: p.type },
        ],
        properties: {
          files: [{ uri: imageUri, type: contentType }],
          category: "image",
        },
      };

      const metadataReceipt = await irys.upload(JSON.stringify(metadata), {
        tags: [
          { name: "Content-Type", value: "application/json" },
          { name: "App", value: "chimp-arena" },
          { name: "Property-Id", value: p.id },
        ],
      });
      const metadataUri = `https://arweave.net/${metadataReceipt.id}`;

      const { error } = await db.from("properties").upsert(
        {
          id: p.id,
          name: p.name,
          zone: p.zone,
          type: p.type,
          price_chimp: p.price_chimp,
          blurb: p.blurb ?? null,
          non_transferable: p.non_transferable ?? false,
          metadata_uri: metadataUri,
        },
        { onConflict: "id" },
      );
      if (error) throw new Error(`db upsert failed: ${error.message}`);

      console.log(`  ok  ${p.id.padEnd(28)} image=${imageReceipt.id.slice(0, 12)}... metadata=${metadataReceipt.id.slice(0, 12)}...`);
      uploaded++;
    } catch (e) {
      console.log(`  FAIL ${p.id.padEnd(28)} ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  console.log(`\nDone. ${uploaded} uploaded, ${failed} failed, ${notReady} not ready yet.`);
}

main();
