/**
 * Uploads real named Astrochimp character art (Common/Rare/One of One) to
 * Arweave via Irys and sets each row's image_url in Supabase - same wallet
 * and permanence tradeoffs as scripts/upload-property-art.mjs, but simpler:
 * these NFTs' metadata is served dynamically from the DB
 * (app/nft/chimp-metadata/...), not a separately-uploaded JSON file, so only
 * the image itself needs a permanent URL.
 *
 * Expects a base directory containing three subfolders exactly named
 * "Common", "Rare", and "One of One", each holding <Character Name>.png
 * files - matches migration 0027's row ids via the same slugify() used to
 * generate them there (lowercase, non-alphanumeric runs -> "-").
 *
 * Usage:
 *   node --env-file=.env.local scripts/upload-chimp-art.mjs "<path to folder with Common/Rare/One of One>"
 *   (add --force to re-upload rows that already have an image_url)
 *
 * Safe to re-run: a row that already has image_url is skipped unless
 * --force is passed. Files in SKIP_FILES below are never uploaded until
 * removed from that list (see migration 0027's note on Asher.png).
 */
import { readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import bs58 from "bs58";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { createClient } from "@supabase/supabase-js";

const FORCE = process.argv.includes("--force");
const BASE_DIR = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));

// Relative path ("<Tier folder>/<file>.png") -> reason it's held back.
// Remove an entry here once replacement art lands, then re-run.
const SKIP_FILES = new Map([
  ["Common/Asher.png", "visible Nike swoosh logo on the sneakers - flagged for legal review before this goes on-chain permanently"],
]);

const TIER_FOLDERS = [
  { folder: "Common", tier: "standard", idPrefix: "std-", table: "chimp_style_variants" },
  { folder: "Rare", tier: "rare", idPrefix: "rare-", table: "chimp_style_variants" },
  { folder: "One of One", tier: "one_of_one", idPrefix: "chimp-1of1-", table: "chimp_variants" },
];

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MIME_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} - run with: node --env-file=.env.local scripts/upload-chimp-art.mjs <dir>`);
    process.exit(1);
  }
  return v;
}

async function main() {
  if (!BASE_DIR) {
    console.error('Usage: node --env-file=.env.local scripts/upload-chimp-art.mjs "<path to folder with Common/Rare/One of One>" [--force]');
    process.exit(1);
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const delegateSecret = requireEnv("MPL_CORE_MINT_DELEGATE_SECRET");
  const rpcUrl = requireEnv("NEXT_PUBLIC_SOLANA_RPC");

  const db = createClient(supabaseUrl, serviceKey);
  const secretKey = bs58.decode(delegateSecret);

  const irys = await Uploader(Solana).withWallet(secretKey).withRpc(rpcUrl).mainnet();
  console.log("Irys node address:", irys.address);
  console.log("Irys balance:", irys.utils.fromAtomic(await irys.getLoadedBalance()).toString(), "SOL");

  // ---- gather every candidate file across the three tier folders ----
  const jobs = [];
  for (const { folder, tier, idPrefix, table } of TIER_FOLDERS) {
    const dir = join(BASE_DIR, folder);
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      console.log(`Skipping "${folder}" - folder not found at ${dir}`);
      continue;
    }
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (!MIME_TYPES[ext]) continue; // skips .DS_Store etc.
      const name = basename(file, ext).trim();
      const relPath = `${folder}/${file}`;
      if (SKIP_FILES.has(relPath)) {
        console.log(`  skip ${relPath.padEnd(40)} ${SKIP_FILES.get(relPath)}`);
        continue;
      }
      jobs.push({ path: join(dir, file), ext, contentType: MIME_TYPES[ext], id: `${idPrefix}${slugify(name)}`, name, tier, table });
    }
  }

  if (jobs.length === 0) {
    console.log("Nothing to upload.");
    return;
  }

  // ---- drop rows that already have art, unless --force ----
  let ready = jobs;
  if (!FORCE) {
    const byTable = new Map();
    for (const j of jobs) {
      if (!byTable.has(j.table)) byTable.set(j.table, []);
      byTable.get(j.table).push(j.id);
    }
    const alreadySet = new Set();
    for (const [table, ids] of byTable) {
      const { data } = await db.from(table).select("id").in("id", ids).not("image_url", "is", null);
      for (const row of data ?? []) alreadySet.add(row.id);
    }
    if (alreadySet.size > 0) {
      console.log(`Skipping ${alreadySet.size} already uploaded (pass --force to redo): ${[...alreadySet].join(", ")}`);
    }
    ready = jobs.filter((j) => !alreadySet.has(j.id));
  }

  if (ready.length === 0) {
    console.log("Nothing left to upload (everything either skipped or already done).");
    return;
  }

  // Irys needs its own prepaid balance, separate from the wallet's SOL.
  const estimatedBytes = ready.reduce((sum, j) => {
    try {
      return sum + statSync(j.path).size;
    } catch {
      return sum;
    }
  }, 0);
  const price = await irys.getPrice(estimatedBytes);
  const loaded = await irys.getLoadedBalance();
  if (loaded.isLessThan(price)) {
    const topUp = price.minus(loaded).multipliedBy(1.1);
    console.log(`Funding Irys with ~${irys.utils.fromAtomic(topUp).toString()} SOL to cover this batch...`);
    await irys.fund(topUp.integerValue());
  }

  console.log(`Uploading ${ready.length} character image${ready.length === 1 ? "" : "s"}...`);

  let uploaded = 0;
  let failed = 0;
  for (const j of ready) {
    try {
      const receipt = await irys.uploadFile(j.path, {
        tags: [
          { name: "Content-Type", value: j.contentType },
          { name: "App", value: "chimp-arena" },
          { name: "Chimp-Variant-Id", value: j.id },
        ],
      });
      const imageUri = `https://gateway.irys.xyz/${receipt.id}`;

      const { error } = await db
        .from(j.table)
        .update({ image_url: imageUri, mime_type: j.contentType })
        .eq("id", j.id);
      if (error) throw new Error(`db update failed: ${error.message}`);

      console.log(`  ok  ${j.id.padEnd(32)} ${receipt.id.slice(0, 12)}...`);
      uploaded++;
    } catch (e) {
      console.log(`  FAIL ${j.id.padEnd(32)} ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  console.log(`\nDone. ${uploaded} uploaded, ${failed} failed.`);
}

main();
