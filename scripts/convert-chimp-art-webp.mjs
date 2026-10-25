/**
 * One-off: re-exports the chimp character art source files as WebP
 * (quality 85) into a separate output folder - originals are never touched.
 *
 * Why WebP, not PNG recompression: these are AI-rendered (Meshy/GPT-image)
 * 1024x1024 photorealistic images with no alpha channel. PNG's lossless
 * compression doesn't help on photographic detail - a max-effort PNG
 * re-encode came out LARGER than the ~2MB originals on every file tested.
 * WebP q85 cut a sample from 2071KB to 301KB (-85%) with no visible
 * artifacts (checked directly). See migration 0030 for the metadata-side
 * change this depends on (mime_type is no longer hardcoded to image/png).
 *
 * Usage:
 *   node scripts/convert-chimp-art-webp.mjs "<source dir with Common/Rare/One of One>" "<output dir>"
 */
import { readdirSync, mkdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import sharp from "sharp";

const SRC = process.argv[2];
const OUT = process.argv[3];
const QUALITY = 85;

if (!SRC || !OUT) {
  console.error('Usage: node scripts/convert-chimp-art-webp.mjs "<source dir>" "<output dir>"');
  process.exit(1);
}

const FOLDERS = ["Common", "Rare", "One of One"];

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;
  let count = 0;

  for (const folder of FOLDERS) {
    const srcDir = join(SRC, folder);
    let files;
    try {
      files = readdirSync(srcDir);
    } catch {
      console.log(`Skipping "${folder}" - not found at ${srcDir}`);
      continue;
    }
    const outDir = join(OUT, folder);
    mkdirSync(outDir, { recursive: true });

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg"].includes(ext)) continue;

      const srcPath = join(srcDir, file);
      const outPath = join(outDir, `${basename(file, ext)}.webp`);
      const before = statSync(srcPath).size;

      await sharp(srcPath).webp({ quality: QUALITY }).toFile(outPath);

      const after = statSync(outPath).size;
      totalBefore += before;
      totalAfter += after;
      count++;
      const pct = (100 * (1 - after / before)).toFixed(0);
      console.log(
        `${folder}/${file}`.padEnd(45),
        `${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (-${pct}%)`,
      );
    }
  }

  console.log(
    `\n${count} files: ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB total`,
  );
}

main();
