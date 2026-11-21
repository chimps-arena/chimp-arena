// Builds shared/src/characters.json - the agreed Astrochimpz roster (Common,
// Rare, One of One) with a colour palette pulled from each NFT's art, so each
// 3D chimp in Astroworld wears its NFT's colours.
//
// Retired styles (the Sep-29 astronaut-suit placeholders, migration 0029) are
// left out: they still resolve for NFTs already minted with them, but they're
// not part of the roster.
//
//   node --env-file=.env.local scripts/make-world-characters.mjs
//
// Re-run after adding new chimp styles. Reads only - never writes to the DB.
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "shared/src/characters.json";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const thumbs = new Set(JSON.parse(readFileSync("lib/nft-thumbs.json", "utf8")));

const styles = await db
  .from("chimp_style_variants")
  .select("id, tier, name, image_url")
  .eq("retired", false)
  .not("image_url", "is", null);
const ones = await db.from("chimp_variants").select("id, name, image_url").not("image_url", "is", null);
if (styles.error) throw styles.error;
if (ones.error) throw ones.error;

const rows = [
  // The DB calls the common tier "standard"; players and the art folders say Common.
  ...styles.data.map((r) => ({ ...r, tier: r.tier === "standard" ? "common" : r.tier })),
  ...ones.data.map((r) => ({ ...r, tier: "one_of_one" })),
];

const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const sat = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Coarse colour histogram of the art (ignoring transparent/backdrop pixels). */
async function palette(file) {
  const { data, info } = await sharp(file).resize(96, 96, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  const corner = [data[0], data[1], data[2]]; // most art sits on a flat backdrop
  for (let i = 0; i < data.length; i += 4) {
    const px = i / 4, x = px % info.width, y = Math.floor(px / info.width);
    // Focus on the middle 70% where the chimp stands.
    if (x < info.width * 0.15 || x > info.width * 0.85 || y < info.height * 0.1) continue;
    if (data[i + 3] < 200) continue;
    const c = [data[i], data[i + 1], data[i + 2]];
    if (Math.abs(c[0] - corner[0]) + Math.abs(c[1] - corner[1]) + Math.abs(c[2] - corner[2]) < 30) continue;
    const key = c.map((v) => v >> 5).join(",");
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += c[0]; b.g += c[1]; b.b += c[2];
    buckets.set(key, b);
  }
  const ranked = [...buckets.values()].map((b) => ({ n: b.n, c: [b.r / b.n, b.g / b.n, b.b / b.n] })).sort((a, b) => b.n - a.n);
  // Skin-ish browns are the chimp, not the suit - skip them for suit colours.
  const skin = (c) => c[0] > c[2] + 25 && c[0] > c[1] + 8 && sat(c) > 0.25 && sat(c) < 0.75 && lum(c) < 170 && lum(c) > 50;
  const suitPool = ranked.filter((r) => !skin(r.c));
  const suit = suitPool[0]?.c ?? [200, 200, 210];
  const far = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 90;
  const trim = suitPool.find((r) => far(r.c, suit))?.c ?? [230, 230, 235];
  const glow = [...ranked].filter((r) => r.n > 8).sort((a, b) => sat(b.c) * lum(b.c) - sat(a.c) * lum(a.c))[0]?.c ?? [168, 85, 247];
  const fur = ranked.find((r) => skin(r.c))?.c ?? [91, 58, 34];
  return { suit: hex(suit), trim: hex(trim), glow: hex(glow), fur: hex(fur) };
}

const out = [];
for (const r of rows) {
  const id = /gateway\.irys\.xyz\/([A-Za-z0-9_-]{43,44})/.exec(r.image_url)?.[1];
  const local = id && thumbs.has(id) ? `public/nft-thumbs/${id}.webp` : null;
  if (!local || !existsSync(local)) {
    console.log(`skip ${r.id} (no local thumbnail - run scripts/make-nft-thumbs.mjs)`);
    continue;
  }
  const colors = await palette(local);
  out.push({ id: r.id, name: r.name, tier: r.tier, image: `/nft-thumbs/${id}.webp`, ...colors });
  console.log(`${r.id.padEnd(34)} suit ${colors.suit} trim ${colors.trim} glow ${colors.glow}`);
}

const order = { one_of_one: 0, rare: 1, common: 2 };
out.sort((a, b) => order[a.tier] - order[b.tier] || a.name.localeCompare(b.name));
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`\n${out.length} characters -> ${OUT}`);
