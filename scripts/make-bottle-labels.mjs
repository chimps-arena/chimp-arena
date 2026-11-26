// Builds the Neon Cantina bottle-label sheet: one label per Astrochimpz
// character (shared/src/characters.json), portrait + name + tier, laid out in
// roster order. Output: public/astroworld/neon-cantina/labels.webp and
// labels.json (cell index per character id) for neon-cantina-bottles.tsx.
//
//   node scripts/make-bottle-labels.mjs
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const CELL_W = 192, CELL_H = 256, COLS = 8;
const chars = JSON.parse(readFileSync("shared/src/characters.json", "utf8"));
const TIER = {
  common: { label: "COMMON", ink: "#e8d3a8", band: "#4a3320", edge: "#c9a36a" },
  rare: { label: "RARE", ink: "#bff4ff", band: "#123a4f", edge: "#4fe3ff" },
  one_of_one: { label: "ONE OF ONE", ink: "#fff1c4", band: "#4a2a06", edge: "#ffc94a" },
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const rows = Math.ceil(chars.length / COLS);
const cells = [];
const index = {};
for (const [i, c] of chars.entries()) {
  const t = TIER[c.tier];
  const portrait = await sharp(`public${c.image}`).resize(160, 160, { fit: "cover" }).png().toBuffer();
  const mask = Buffer.from(`<svg width="160" height="160"><rect x="0" y="0" width="160" height="160" rx="80" ry="80"/></svg>`);
  const round = await sharp(portrait).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  // Names never clipped: one line when it fits, else two balanced lines, shrunk to fit.
  const fit = (t) => Math.min(24, Math.floor(160 / (0.56 * t.length)));
  let lines = [c.name];
  if (fit(c.name) < 17) {
    const w = c.name.split(" ");
    let best = null;
    for (let k = 1; k < w.length; k++) {
      const a = w.slice(0, k).join(" "), b = w.slice(k).join(" ");
      if (!best || Math.max(a.length, b.length) < Math.max(best[0].length, best[1].length)) best = [a, b];
    }
    if (best) lines = best;
  }
  const size = Math.min(...lines.map(fit), lines.length > 1 ? 17 : 24);
  const nameSvg = lines.length === 1
    ? `<text x="${CELL_W / 2}" y="214" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="${size}" fill="${t.ink}">${esc(lines[0])}</text>`
    : lines.map((l, j) => `<text x="${CELL_W / 2}" y="${204 + j * (size + 1)}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="${size}" fill="${t.ink}">${esc(l)}</text>`).join("");
  const frame = Buffer.from(`<svg width="${CELL_W}" height="${CELL_H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="${CELL_W - 6}" height="${CELL_H - 6}" rx="10" fill="#f3ead8" stroke="${t.edge}" stroke-width="5"/>
    <rect x="10" y="10" width="${CELL_W - 20}" height="${CELL_H - 20}" rx="7" fill="none" stroke="#3a2a1a" stroke-width="1.5"/>
    <circle cx="${CELL_W / 2}" cy="98" r="84" fill="${t.band}"/>
    <circle cx="${CELL_W / 2}" cy="98" r="83" fill="none" stroke="${t.edge}" stroke-width="3"/>
    <rect x="10" y="186" width="${CELL_W - 20}" height="60" fill="${t.band}"/>
    ${nameSvg}
    <text x="${CELL_W / 2}" y="239" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="12" letter-spacing="3" fill="${t.edge}">${t.label}</text>
  </svg>`);
  const cell = await sharp(frame).composite([{ input: round, left: CELL_W / 2 - 80, top: 18 }]).png().toBuffer();
  cells.push({ input: cell, left: (i % COLS) * CELL_W, top: Math.floor(i / COLS) * CELL_H });
  index[c.id] = i;
}
await sharp({ create: { width: COLS * CELL_W, height: rows * CELL_H, channels: 4, background: "#00000000" } })
  .composite(cells)
  .webp({ quality: 88 })
  .toFile("public/astroworld/neon-cantina/labels.webp");
writeFileSync(
  "public/astroworld/neon-cantina/labels.json",
  JSON.stringify({ cols: COLS, rows, cellW: CELL_W, cellH: CELL_H, index }, null, 1) + "\n",
);
console.log(`${chars.length} labels, ${COLS}x${rows} sheet`);
