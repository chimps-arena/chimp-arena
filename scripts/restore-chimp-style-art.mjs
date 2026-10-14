/**
 * One-off repair: re-uploads the 16 original Sep-29 Standard/Rare style art
 * files (still sitting in scripts/chimp-art/, gitignored, never deleted)
 * and resets image_url on the rows migration 0029 restores. See that
 * migration's header comment for what happened and why.
 *
 * Usage: node --env-file=.env.local scripts/restore-chimp-style-art.mjs
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import bs58 from "bs58";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { createClient } from "@supabase/supabase-js";

const ART_DIR = fileURLToPath(new URL("./chimp-art/", import.meta.url));

const IDS = [
  "std-ember", "std-frost", "std-verdant", "std-voltage", "std-slate",
  "std-rosewater", "std-copper", "std-indigo", "std-sand", "std-mint",
  "rare-voidwalker", "rare-aurora", "rare-magnetar", "rare-solflare",
  "rare-deepcore", "rare-wraith",
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} - run with: node --env-file=.env.local scripts/restore-chimp-style-art.mjs`);
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
  const irys = await Uploader(Solana).withWallet(bs58.decode(delegateSecret)).withRpc(rpcUrl).mainnet();
  console.log("Irys balance:", irys.utils.fromAtomic(await irys.getLoadedBalance()).toString(), "SOL");

  const { data: rows } = await db.from("chimp_style_variants").select("id").in("id", IDS);
  const existingIds = new Set((rows ?? []).map((r) => r.id));
  const missing = IDS.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    console.error(`These rows don't exist yet - run migration 0029 first: ${missing.join(", ")}`);
    process.exit(1);
  }

  let fixed = 0;
  let failed = 0;
  for (const id of IDS) {
    const path = `${ART_DIR}${id}.png`;
    if (!existsSync(path)) {
      console.log(`  FAIL ${id.padEnd(20)} art file not found at ${path}`);
      failed++;
      continue;
    }
    try {
      const receipt = await irys.uploadFile(path, {
        tags: [
          { name: "Content-Type", value: "image/png" },
          { name: "App", value: "chimp-arena" },
          { name: "Chimp-Variant-Id", value: id },
        ],
      });
      const imageUri = `https://gateway.irys.xyz/${receipt.id}`;
      const { error } = await db.from("chimp_style_variants").update({ image_url: imageUri }).eq("id", id);
      if (error) throw new Error(`db update failed: ${error.message}`);
      console.log(`  ok  ${id.padEnd(20)} ${receipt.id.slice(0, 12)}...`);
      fixed++;
    } catch (e) {
      console.log(`  FAIL ${id.padEnd(20)} ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  console.log(`\nDone. ${fixed} restored, ${failed} failed.`);
}

main();
