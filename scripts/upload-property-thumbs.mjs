// Uploads the small WebP copy of every on-chain property's art to Irys
// (permanent storage, same host as the Astrochimp images) and writes
// lib/property-nft-images.json: { propertyId: "https://gateway.irys.xyz/<id>" }.
// The property metadata route serves these to wallets instead of our own
// chimp-arena.vercel.app copies (dev log #13). Safe to re-run: properties
// already in the JSON are skipped.
//   node --env-file=.env.local scripts/upload-property-thumbs.mjs [--dry]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import bs58 from "bs58";
import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { Keypair } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";

const OUT = "lib/property-nft-images.json";
const DRY = process.argv.includes("--dry");
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await db.from("properties").select("id,image_url").not("asset_address", "is", null).order("id");
if (error) throw error;

const todo = [];
for (const p of data) {
  if (done[p.id]) continue;
  const id = /gateway\.irys\.xyz\/([A-Za-z0-9_-]{43,44})/.exec(p.image_url ?? "")?.[1];
  const file = id && `public/nft-thumbs/${id}.webp`;
  if (!file || !existsSync(file)) { console.log("skip (no thumb):", p.id); continue; }
  todo.push({ id: p.id, file });
}
const bytes = todo.reduce((s, t) => s + readFileSync(t.file).length, 0);
console.log(`${todo.length} to upload, ${Math.round(bytes / 1024)} KB`);
if (DRY || !todo.length) process.exit(0);

const secret = process.env.MPL_CORE_MINT_DELEGATE_SECRET.trim();
const kp = Keypair.fromSecretKey(secret.startsWith("[") ? Uint8Array.from(JSON.parse(secret)) : bs58.decode(secret));
const irys = await Uploader(Solana).withWallet(bs58.encode(kp.secretKey)).withRpc(process.env.NEXT_PUBLIC_SOLANA_RPC).mainnet();
const price = await irys.getPrice(bytes + todo.length * 2048);
const have = await irys.getLoadedBalance();
console.log("price", irys.utils.fromAtomic(price).toString(), "SOL; loaded", irys.utils.fromAtomic(have).toString());
if (have.lt(price)) {
  const r = await irys.fund(price.minus(have).multipliedBy(1.2).integerValue());
  console.log("funded", irys.utils.fromAtomic(r.quantity).toString(), "SOL");
}
for (const t of todo) {
  const r = await irys.upload(readFileSync(t.file), { tags: [{ name: "Content-Type", value: "image/webp" }] });
  done[t.id] = `https://gateway.irys.xyz/${r.id}`;
  writeFileSync(OUT, JSON.stringify(done, null, 2) + "\n");
  console.log("uploaded", t.id, done[t.id]);
}
console.log("all done:", Object.keys(done).length);
