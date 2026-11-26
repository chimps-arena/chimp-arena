// Cuts parts out of a building model: every triangle whose centre falls inside
// one of the given boxes is removed. Used to take out pieces the game redraws
// itself (e.g. Meshy's rough bar stools on the Neon Cantina, replaced by
// BarrelStool in components/astroworld/neon-cantina.tsx).
//
//   node scripts/cut-model-boxes.mjs <in.glb> <out.glb> <boxes.json> [--width 12]
//
// Box coordinates are game metres in the building's own space, the same space
// the game draws it in: scaled to --width across x, centred on x/z, base on y=0.
//   boxes.json: [{ "min": [x, y, z], "max": [x, y, z], "note": "stool 1" }, ...]
import sharp from "sharp"; // load before gltf-transform: see optimize-models.mjs
import { readFileSync } from "node:fs";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { prune, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
void sharp;

const [inp, out, boxesFile] = process.argv.slice(2);
if (!inp || !out || !boxesFile) throw new Error("usage: cut-model-boxes.mjs <in.glb> <out.glb> <boxes.json> [--width 12]");
const wi = process.argv.indexOf("--width");
const WIDTH = wi > 0 ? Number(process.argv[wi + 1]) : 12;
const boxes = JSON.parse(readFileSync(boxesFile, "utf8"));

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(inp);
const scene = doc.getRoot().listScenes()[0];
const b = getBounds(scene);
const k = WIDTH / (b.max[0] - b.min[0]);
const cx = (b.max[0] + b.min[0]) / 2, cz = (b.max[2] + b.min[2]) / 2;

let removed = 0, kept = 0;
const v = [0, 0, 0];
for (const node of scene.listChildren().flatMap(function all(n) { return [n, ...n.listChildren().flatMap(all)]; })) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const idx = prim.getIndices();
    if (!idx) throw new Error("unindexed primitive: weld first");
    const game = (i) => {
      pos.getElement(i, v);
      const [x, y, z] = v;
      return [
        (m[0] * x + m[4] * y + m[8] * z + m[12] - cx) * k,
        (m[1] * x + m[5] * y + m[9] * z + m[13] - b.min[1]) * k,
        (m[2] * x + m[6] * y + m[10] * z + m[14] - cz) * k,
      ];
    };
    const src = idx.getArray();
    const keep = [];
    for (let t = 0; t < src.length; t += 3) {
      const [a, c, d] = [game(src[t]), game(src[t + 1]), game(src[t + 2])];
      const p = [0, 1, 2].map((j) => (a[j] + c[j] + d[j]) / 3);
      const hit = boxes.some((bx) => p.every((val, j) => val >= bx.min[j] && val <= bx.max[j]));
      if (hit) removed++;
      else {
        kept++;
        keep.push(src[t], src[t + 1], src[t + 2]);
      }
    }
    idx.setArray(new Uint32Array(keep));
  }
}
await doc.transform(prune(), weld());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(out, doc);
console.log(`removed ${removed} triangles, kept ${kept}`);
