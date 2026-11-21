// Checks artist-delivered character models and switches them on in the game.
//
//   node scripts/check-models.mjs [dir=public/models/characters]
//
// For every <character id>.glb in the folder it reports: is the id on the
// roster, is it rigged (has a skeleton), which moves its animation clips
// cover, its size and triangle count, and its compression. Models that pass
// are written to index.json in that folder - the game only loads models
// listed there, so a broken file never reaches players.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mapClips, REQUIRED_ROLES, OPTIONAL_ROLES } from "../shared/src/model-clips.ts";

const DIR = process.argv[2] ?? "public/models/characters";
const roster = JSON.parse(readFileSync(new URL("../shared/src/characters.json", import.meta.url), "utf8"));
const byId = new Map(roster.map((c) => [c.id, c]));

const MAX_TRIS_WARN = 20000;
const MAX_TRIS_ERR = 60000;
const MAX_MB_WARN = 6;

/** Parse the JSON chunk of a .glb (binary glTF). */
function readGlb(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a .glb file (bad magic) - export as glTF Binary");
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`glTF version ${version}, need 2`);
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error("first chunk is not JSON");
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
}

function triangles(gltf) {
  let tris = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const mode = prim.mode ?? 4;
      if (mode !== 4) continue;
      const acc = gltf.accessors?.[prim.indices ?? prim.attributes?.POSITION];
      if (acc) tris += Math.floor(acc.count / 3);
    }
  }
  return tris;
}

const files = (() => {
  try {
    return readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".glb"));
  } catch {
    return [];
  }
})();

if (files.length === 0) {
  console.log(`No .glb models in ${DIR} yet. Name them after the character id, e.g. rare-deezy-chimp.glb`);
}

const index = {};
let failed = 0;

for (const f of files) {
  const id = f.replace(/\.glb$/i, "");
  const errors = [];
  const warns = [];
  const notes = [];
  const character = byId.get(id);
  if (!character) errors.push(`"${id}" isn't a roster character id (see shared/src/characters.json) - rename the file`);

  let gltf;
  try {
    gltf = readGlb(join(DIR, f));
  } catch (e) {
    errors.push(e.message);
  }

  let clips = [];
  if (gltf) {
    const mb = statSync(join(DIR, f)).size / 1e6;
    const tris = triangles(gltf);
    const skins = gltf.skins?.length ?? 0;
    const jointNames = (gltf.skins?.[0]?.joints ?? []).map((j) => gltf.nodes?.[j]?.name ?? "");
    clips = (gltf.animations ?? []).map((a, i) => a.name || `clip ${i}`);
    const roles = mapClips(clips);
    const ext = gltf.extensionsUsed ?? [];

    notes.push(`${mb.toFixed(1)} MB, ${tris.toLocaleString()} triangles, ${jointNames.length} bones, ${clips.length} clips`);
    if (skins === 0) errors.push("no skeleton - the model isn't rigged (rig it in Mixamo or the 3D tool first)");
    if (skins > 0 && !jointNames.some((n) => /hips/i.test(n))) warns.push("no 'Hips' bone - not a Mixamo-style humanoid skeleton, animations may not fit");
    for (const r of REQUIRED_ROLES) if (!roles[r]) errors.push(`missing a "${r}" animation clip (name one with "${r}" in it)`);
    const missing = OPTIONAL_ROLES.filter((r) => !roles[r]);
    if (missing.length) warns.push(`no clip for: ${missing.join(", ")} - the game will reuse the closest move`);
    const unmatched = clips.filter((n) => !Object.values(roles).includes(n));
    if (unmatched.length) warns.push(`clips the game won't use (unrecognised names): ${unmatched.join(", ")}`);
    if (tris > MAX_TRIS_ERR) errors.push(`${tris.toLocaleString()} triangles is far too heavy for 40 players on screen - reduce to ~15k`);
    else if (tris > MAX_TRIS_WARN) warns.push(`${tris.toLocaleString()} triangles - aim for ~15k`);
    if (mb > MAX_MB_WARN) warns.push(`${mb.toFixed(1)} MB - compress (see docs/3d-characters.md, step 5)`);
    if (ext.includes("KHR_draco_mesh_compression")) warns.push("Draco-compressed: works, but loads a decoder from Google's CDN - prefer --compress meshopt");
    if (!ext.includes("EXT_meshopt_compression") && !ext.includes("KHR_draco_mesh_compression")) warns.push("not compressed - run the optimize step");
    notes.push(`moves: ${Object.entries(roles).map(([r, n]) => `${r}=${n}`).join(", ") || "none"}`);
  }

  const ok = errors.length === 0;
  if (!ok) failed++;
  console.log(`\n${ok ? "PASS" : "FAIL"}  ${f}${character ? `  (${character.name})` : ""}`);
  for (const n of notes) console.log(`      ${n}`);
  for (const w of warns) console.log(`  !   ${w}`);
  for (const e of errors) console.log(`  x   ${e}`);
  if (ok) index[id] = { file: f, clips };
}

writeFileSync(join(DIR, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`\n${Object.keys(index).length} model(s) switched on in ${join(DIR, "index.json")}${failed ? `, ${failed} need fixing` : ""}.`);
process.exit(failed ? 1 : 0);
