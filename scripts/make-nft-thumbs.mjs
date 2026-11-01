// Downloads every NFT/property image from Irys once and writes a small web
// copy to public/nft-thumbs/<irys id>.webp, plus lib/nft-thumbs.json (the
// list of ids that have one). The Irys gateway is slow (property PNGs are
// ~2.8 MB and take ~40s each), so the site shows these instead - see
// lib/nft-image.ts. Re-run after uploading new art:
//   node --env-file=.env.local scripts/make-nft-thumbs.mjs
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { existsSync, writeFileSync } from "node:fs";

const OUT = "public/nft-thumbs";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const urls = new Set();
for (const t of ["chimp_variants", "chimp_style_variants", "properties"]) {
  const { data, error } = await db.from(t).select("image_url");
  if (error) throw error;
  for (const r of data) if (r.image_url) urls.add(r.image_url);
}
const ids = [...urls].map((u) => /gateway\.irys\.xyz\/([A-Za-z0-9_-]{43,44})/.exec(u)?.[1]).filter(Boolean);
console.log(`${ids.length} images`);

let made = 0, skipped = 0, failed = [];
const queue = [...ids];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const id = queue.shift();
    const file = `${OUT}/${id}.webp`;
    if (existsSync(file)) { skipped++; continue; }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`https://gateway.irys.xyz/${id}`, { signal: AbortSignal.timeout(240_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await sharp(buf).resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(file);
        made++;
        console.log(`ok ${made + skipped}/${ids.length} ${id.slice(0, 8)} ${(buf.length / 1024).toFixed(0)}KB`);
        break;
      } catch (e) {
        if (attempt === 3) { failed.push(id); console.log(`FAIL ${id.slice(0, 8)} ${e.message}`); }
      }
    }
  }
}));
const have = ids.filter((id) => existsSync(`${OUT}/${id}.webp`)).sort();
writeFileSync("lib/nft-thumbs.json", JSON.stringify(have) + "\n");
console.log(`done: ${made} made, ${skipped} already there, ${failed.length} failed; manifest has ${have.length}`);
