/**
 * Uploads Astrochimp character art + metadata to Arweave (permanent) and
 * writes each result into Supabase - one_of_one ids go into chimp_variants
 * (the finite, claimable catalog, migration 0014/0015), standard/rare ids
 * go into chimp_style_variants (the reusable, non-scarce art pool,
 * migration 0016). /api/mint/claim picks these up automatically once
 * image_url is set - nothing else needs to change to go live.
 *
 * Same Irys pipeline as scripts/upload-property-art.mjs, same funding
 * wallet, same "arweave.net only catches up later, gateway.irys.xyz
 * resolves immediately" fix already baked in from the start this time.
 *
 * Usage:
 *   1. Drop art into scripts/chimp-art/, named exactly after the id in
 *      scripts/chimp-manifest.json - e.g. std-ember.png.
 *   2. node --env-file=.env.local scripts/upload-chimp-art.mjs
 *
 * An id with no matching art file yet is skipped, not errored - drop the
 * rest in later and re-run. Safe to re-run: ids that already have art are
 * skipped unless --force is passed.
 */
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bs58 from "bs58";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { createClient } from "@supabase/supabase-js";

const MANIFEST_PATH = fileURLToPath(new URL("./chimp-manifest.json", import.meta.url));
const ART_DIR = fileURLToPath(new URL("./chimp-art/", import.meta.url));
const FORCE = process.argv.includes("--force");

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];
const MIME_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function findArtFile(id) {
  for (const ext of IMAGE_EXTS) {
    const candidate = join(ART_DIR, `${id}${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} - run with: node --env-file=.env.local scripts/upload-chimp-art.mjs`);
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
  console.log("Irys balance:", irys.utils.fromAtomic(await irys.getLoadedBalance()).toString(), "SOL");

  const manifestRaw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const manifest = manifestRaw.map((p) => ({ ...p, image: findArtFile(p.id) }));
  const ready = manifest.filter((p) => p.image);
  const notReady = manifest.length - ready.length;
  if (notReady > 0) {
    console.log(`Skipping ${notReady} id${notReady === 1 ? "" : "s"} with no matching art file yet.`);
  }
  if (ready.length === 0) {
    console.log("Nothing ready - drop art into scripts/chimp-art/<id>.png first.");
    return;
  }

  if (!FORCE) {
    const oneOfOneIds = ready.filter((p) => p.tier === "one_of_one").map((p) => p.id);
    const styleIds = ready.filter((p) => p.tier !== "one_of_one").map((p) => p.id);
    const skip = new Set();
    if (oneOfOneIds.length) {
      const { data } = await db.from("chimp_variants").select("id").in("id", oneOfOneIds).not("image_url", "is", null);
      (data ?? []).forEach((r) => skip.add(r.id));
    }
    if (styleIds.length) {
      const { data } = await db.from("chimp_style_variants").select("id").in("id", styleIds).not("image_url", "is", null);
      (data ?? []).forEach((r) => skip.add(r.id));
    }
    if (skip.size > 0) {
      console.log(`Skipping ${skip.size} already-uploaded (pass --force to redo): ${[...skip].join(", ")}`);
    }
    for (let i = ready.length - 1; i >= 0; i--) {
      if (skip.has(ready[i].id)) ready.splice(i, 1);
    }
  }
  if (ready.length === 0) {
    console.log("Nothing left to upload.");
    return;
  }

  const estimatedBytes = ready.length * 400_000; // rough per-image guess, funding tops up if short
  const price = await irys.getPrice(estimatedBytes);
  const loaded = await irys.getLoadedBalance();
  if (loaded.isLessThan(price)) {
    const topUp = price.minus(loaded).multipliedBy(1.1);
    console.log(`Funding Irys with ~${irys.utils.fromAtomic(topUp).toString()} SOL...`);
    await irys.fund(topUp.integerValue());
  }

  console.log(`Uploading ${ready.length} chimp${ready.length === 1 ? "" : "s"}...`);
  let uploaded = 0;
  let failed = 0;

  for (const p of ready) {
    try {
      const ext = extname(p.image).toLowerCase();
      const contentType = MIME_TYPES[ext];
      if (!contentType) throw new Error(`unrecognized image extension: ${ext}`);

      const imageReceipt = await irys.uploadFile(p.image, {
        tags: [
          { name: "Content-Type", value: contentType },
          { name: "App", value: "chimp-arena" },
          { name: "Chimp-Id", value: p.id },
        ],
      });
      const imageUri = `https://gateway.irys.xyz/${imageReceipt.id}`;

      const tierLabel = p.tier === "one_of_one" ? "One of One" : p.tier === "rare" ? "Rare" : "Standard";
      const metadata = {
        name: p.name,
        symbol: "ACHMP",
        description: `An Astrochimp from the Astrochimpz mint (${tierLabel} tier).`,
        image: imageUri,
        external_url: "https://astrochimpz.com",
        attributes: [{ trait_type: "Tier", value: tierLabel }],
        properties: { files: [{ uri: imageUri, type: contentType }], category: "image" },
      };

      const metadataReceipt = await irys.upload(JSON.stringify(metadata), {
        tags: [
          { name: "Content-Type", value: "application/json" },
          { name: "App", value: "chimp-arena" },
          { name: "Chimp-Id", value: p.id },
        ],
      });
      const metadataUri = `https://gateway.irys.xyz/${metadataReceipt.id}`;

      const table = p.tier === "one_of_one" ? "chimp_variants" : "chimp_style_variants";
      const { error } = await db
        .from(table)
        .update({ image_url: imageUri, metadata_uri: metadataUri })
        .eq("id", p.id);
      if (error) throw new Error(`db update failed: ${error.message}`);

      console.log(`  ok  ${p.id.padEnd(28)} image=${imageReceipt.id.slice(0, 12)}...`);
      uploaded++;
    } catch (e) {
      console.error(`  FAIL ${p.id}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${failed} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
