// Shrinks artist/AI-made .glb models to web size for Astroworld.
//
//   node scripts/optimize-models.mjs <in.glb> <out.glb> [--texture 1024]
//   node scripts/optimize-models.mjs --manifest <manifest.json>
//
// Manifest: { "sourceDir": "...", "outDir": "public/models/items",
//             "texture": 1024, "rootInPlace": false,
//             "models": { "<id>": "<path under sourceDir>" } }
// rootInPlace: true for rigged characters (walk cycles play on the spot).
//
// What it does: drops duplicate/unused data, resizes every texture to at most
// --texture px and re-encodes it as WebP, then meshopt-compresses geometry
// (decoded in the browser with no extra download). Typical result: a 25-30 MB
// delivery becomes well under 1 MB. Uses the project's own sharp for images
// (the gltf-transform CLI's bundled image library fails on Windows).
// sharp MUST load before @gltf-transform/functions: that package pulls in an
// older nested sharp (via ndarray-pixels), and on Windows whichever native
// libvips loads first wins - loading ours second fails with ERR_DLOPEN_FAILED.
import sharp from "sharp";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, quantize, reorder, resample, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

/**
 * Characters: pin the hips' horizontal position in every clip, so walk/run
 * cycles play on the spot. The game moves the character; root motion baked
 * into a clip would make the body drift away from where the server says the
 * player is. Vertical bob is kept.
 */
function rootInPlace() {
  return (doc) => {
    for (const anim of doc.getRoot().listAnimations()) {
      for (const ch of anim.listChannels()) {
        const node = ch.getTargetNode();
        if (ch.getTargetPath() !== "translation" || !node || !/hips$/i.test(node.getName())) continue;
        const out = ch.getSampler()?.getOutput();
        const a = out?.getArray();
        if (!a || a.length < 3) continue;
        const [x0, , z0] = [a[0], a[1], a[2]];
        const copy = a.slice();
        for (let i = 0; i < copy.length; i += 3) {
          copy[i] = x0;
          copy[i + 2] = z0;
        }
        out.setArray(copy);
      }
    }
  };
}

async function optimize(input, output, textureSize, { inPlace = false } = {}) {
  const doc = await io.read(input);
  if (inPlace) await doc.transform(rootInPlace());
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    resample(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [textureSize, textureSize], quality: 85 }),
    reorder({ encoder: MeshoptEncoder }),
    quantize(),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  mkdirSync(dirname(output), { recursive: true });
  await io.write(output, doc);
  const mb = (f) => (statSync(f).size / 1e6).toFixed(2);
  console.log(`${output}  ${mb(input)} MB -> ${mb(output)} MB`);
}

const manifestPath = flag("--manifest");
if (manifestPath) {
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const [id, rel] of Object.entries(m.models)) {
    try {
      await optimize(join(m.sourceDir, rel), join(m.outDir, `${id}.glb`), m.texture ?? 1024, { inPlace: !!m.rootInPlace });
    } catch (e) {
      console.log(`FAIL ${id}: ${e.message}`);
      process.exitCode = 1;
    }
  }
} else {
  const [input, output] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!input || !output) throw new Error("usage: optimize-models.mjs <in.glb> <out.glb> [--texture 1024]");
  await optimize(input, output, Number(flag("--texture", 1024)));
}
