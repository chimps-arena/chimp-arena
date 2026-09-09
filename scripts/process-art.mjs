/**
 * Generates web-optimised derivatives from the two source art files.
 *
 *   npm i -D sharp
 *   node scripts/process-art.mjs
 *
 * Reads:
 *   public/brand/chimp-logo.png       (>=512, transparent preferred)
 *   public/characters/astrochimp.png  (>=512, transparent preferred)
 *
 * Writes:
 *   public/brand/chimp-logo-512.png       token / listing icon
 *   public/characters/astrochimp-512.png  NFT image (kept small for on-chain ref)
 *   public/icon.png                       favicon (Next app-icon convention)
 *   public/og.png                         1200x630 social share card
 *
 * <Image> resizes the full-res sources on the fly, so this is only for the
 * fixed-size assets above.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Install sharp first:  npm i -D sharp");
  process.exit(1);
}

const p = (rel) => fileURLToPath(new URL(`../public/${rel}`, import.meta.url));
const logo = p("brand/chimp-logo.png");
const char = p("characters/astrochimp.png");

for (const [label, f] of [["logo", logo], ["character", char]]) {
  if (!existsSync(f)) {
    console.error(`Missing ${label}: ${f} — drop the PNG there first.`);
    process.exit(1);
  }
}

const clear = { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } };

await sharp(logo).resize(512, 512, clear).png({ quality: 90 }).toFile(p("brand/chimp-logo-512.png"));
await sharp(logo).resize(256, 256).png({ quality: 90 }).toFile(p("icon.png"));
await sharp(char).resize(512, 512, clear).png({ quality: 90 }).toFile(p("characters/astrochimp-512.png"));

// OG card: logo centred on the void-navy ground.
await sharp({
  create: { width: 1200, height: 630, channels: 4, background: { r: 7, g: 10, b: 18, alpha: 1 } },
})
  .composite([{ input: await sharp(logo).resize(360, 360).png().toBuffer(), gravity: "centre" }])
  .png()
  .toFile(p("og.png"));

console.log("Wrote chimp-logo-512.png, icon.png, astrochimp-512.png, og.png");
