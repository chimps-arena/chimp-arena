// Makes one Astroworld building with the Meshy API and drops it into the game.
//
//   From the building's NFT art (preferred: the game matches what owners bought):
//     node --env-file=.env.local scripts/meshy-build.mjs <type> --art [--variant art]
//       1st run: Meshy redraws the NFT painting (public/properties/<type>.png) as
//                the building alone, three-quarter view, plain background, and
//                stops so a person can approve that picture (~3-12 credits).
//       2nd run, add --approve: image -> 3D model (~30 credits) -> game.
//     Optional --brief "..." adds what to keep from the painting (canopy, lights...).
//
//   From a text prompt in docs/meshy-prompts.md:
//     node --env-file=.env.local scripts/meshy-build.mjs <type> [--variant 2]
//       preview mesh (~20 credits) -> textures (~10 credits) -> game.
//
// Common: --polys N (default 10000). Raw downloads + thumbnails go to
// MATERIALS/meshy-api/ (Meshy deletes API results after 3 days); the game copy
// is compressed by scripts/optimize-models.mjs into public/models/env/<name>.glb.
//
// Task ids are saved next to the download, so re-running after a crash or a
// network drop picks up the same tasks instead of paying for new ones.
// Delete <name>.json there to start over.
//
// Needs MESHY_API_KEY in .env.local (never commit it). Spend is capped by the
// key's monthly credit limit on meshy.ai/developers/keys.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import sharp from "sharp";

const API = "https://api.meshy.ai/openapi";
const KEY = process.env.MESHY_API_KEY;
if (!KEY) throw new Error("MESHY_API_KEY missing: add it to .env.local and run with --env-file=.env.local");

const args = process.argv.slice(2);
const type = args[0];
if (!type || type.startsWith("--")) throw new Error("usage: meshy-build.mjs <type> [--art [--approve] [--brief ...]] [--variant N] [--polys N]");
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const has = (name) => args.includes(name);
const fromArt = has("--art");
const variant = flag("--variant", fromArt ? "art" : "");
const polys = Number(flag("--polys", "10000"));
// --name names the output after one property (e.g. neon-cantina); each property has its own NFT art.
const name = flag("--name", variant ? `${type}-${variant}` : type);

const RAW_DIR = process.env.MESHY_RAW_DIR ?? join(homedir(), "OneDrive", "Desktop", "MATERIALS", "meshy-api");
const OUT = join("public", "models", "env", `${name}.glb`);
mkdirSync(RAW_DIR, { recursive: true });

/** The building's prompt + the shared style line, from docs/meshy-prompts.md. */
function promptFor(t) {
  const sheet = readFileSync("docs/meshy-prompts.md", "utf8").replace(/\r/g, "");
  const quote = (block) => block.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "")).join(" ").trim();
  const style = sheet.match(/### Style line[^\n]*\n\n((?:>.*\n)+)/);
  const own = sheet.match(new RegExp(`\\*\\*${t}\\*\\*[^\\n]*\\n((?:>.*\\n)+)`));
  if (!style || !own) throw new Error(`no prompt for "${t}" in docs/meshy-prompts.md`);
  return `${quote(own[1])}. ${quote(style[1])}`;
}

/** fetch that rides out brief network drops (never retries a POST: that could pay twice). */
async function fetchRetry(url, init, tries = init?.method === "POST" ? 1 : 8) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (i >= tries) throw e;
      console.log(`  network hiccup (${e.cause?.code ?? e.message}), retrying...`);
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
}

async function api(path, body) {
  const init = body ? { method: "POST", body: JSON.stringify(body) } : {};
  const res = await fetchRetry(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Meshy ${init.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function waitFor(path, label) {
  let last = -1;
  for (;;) {
    const t = await api(path);
    if (t.progress !== last) {
      console.log(`  ${label}: ${t.status} ${t.progress}%`);
      last = t.progress;
    }
    if (t.status === "SUCCEEDED") return t;
    if (t.status === "FAILED" || t.status === "CANCELED") throw new Error(`${label} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await new Promise((r) => setTimeout(r, 8000));
  }
}

const download = async (url, file) => writeFileSync(file, Buffer.from(await (await fetchRetry(url)).arrayBuffer()));

const statePath = join(RAW_DIR, `${name}.json`);
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

let model; // the finished Meshy task that holds the textured GLB
if (fromArt) {
  // 1. NFT painting -> the building alone on a plain background.
  // Use the property's own NFT art (--art-file); public/properties/<type>.png is only a generic stand-in.
  const art = flag("--art-file", `public/properties/${type}.png`);
  if (!existsSync(art)) throw new Error(`no NFT art at ${art}`);
  // --prompt replaces the whole concept prompt (for faithful, property-specific briefs).
  state.prompt ??= flag("--prompt") ??
    `From this painting, draw ONLY the ${type} building itself as a standalone 3D game asset concept, ` +
    `keeping its exact design, shapes, materials, colours and lighting from the painting` +
    (has("--brief") ? `: ${flag("--brief")}` : "") +
    `. Show the whole building from a three-quarter view slightly above, centered, on a plain light grey background. ` +
    `Remove everything else: no floor tiles, no plants, no furniture around it, no city, no sky, no planets, no ships, no people. ` +
    `Leave every sign, menu board, banner and label as a blank panel with no lettering (exact text is added in the game).`;
  console.log(`${name}: ${state.prompt}`);
  if (!state.concept) {
    const jpg = await sharp(art).resize(1536, 1536, { fit: "inside" }).jpeg({ quality: 90 }).toBuffer();
    state.concept = (
      await api("/v1/image-to-image", {
        ai_model: flag("--image-model", "nano-banana-pro"),
        prompt: state.prompt,
        reference_image_urls: [`data:image/jpeg;base64,${jpg.toString("base64")}`],
        aspect_ratio: flag("--aspect", "1:1"),
      })
    ).result;
    save();
  }
  const concept = await waitFor(`/v1/image-to-image/${state.concept}`, "concept picture");
  const conceptPng = join(RAW_DIR, `${name}-concept.png`);
  if (!existsSync(conceptPng)) await download(concept.image_urls[0], conceptPng);
  state.conceptCredits = concept.consumed_credits ?? 0;
  save();
  if (!has("--approve") && !state.model) {
    console.log(`concept picture: ${conceptPng} (${state.conceptCredits} credits)`);
    console.log("Check it against the NFT art, then re-run with --approve to build the 3D model.");
    process.exit(0);
  }

  // 2. Approved picture -> textured 3D model.
  if (!state.model) {
    state.model = (
      await api("/v1/image-to-3d", {
        input_task_id: state.concept,
        ai_model: "latest",
        should_remesh: true,
        topology: "triangle",
        target_polycount: polys,
        enable_pbr: true,
        target_formats: ["glb"],
      })
    ).result;
    save();
  }
  model = await waitFor(`/v1/image-to-3d/${state.model}`, "3D model");
  state.credits = state.conceptCredits + (model.consumed_credits ?? 0);
} else {
  state.prompt ??= promptFor(type);
  console.log(`${name}: ${state.prompt}`);
  if (state.prompt.length > 800) throw new Error(`prompt is ${state.prompt.length} chars; Meshy allows 800`);
  if (!state.preview) {
    state.preview = (
      await api("/v2/text-to-3d", {
        mode: "preview",
        prompt: state.prompt,
        ai_model: "latest",
        should_remesh: true,
        topology: "triangle",
        target_polycount: polys,
        target_formats: ["glb"],
      })
    ).result;
    save();
  }
  const preview = await waitFor(`/v2/text-to-3d/${state.preview}`, "mesh");
  if (!state.refine) {
    state.refine = (
      await api("/v2/text-to-3d", { mode: "refine", preview_task_id: state.preview, enable_pbr: true, target_formats: ["glb"] })
    ).result;
    save();
  }
  model = await waitFor(`/v2/text-to-3d/${state.refine}`, "textures");
  state.credits = (preview.consumed_credits ?? 0) + (model.consumed_credits ?? 0);
}

const rawGlb = join(RAW_DIR, `${name}.glb`);
await download(model.model_urls.glb, rawGlb);
if (model.thumbnail_url) await download(model.thumbnail_url, join(RAW_DIR, `${name}.png`));
state.downloaded = new Date().toISOString();
save();
console.log(`saved ${rawGlb} (${state.credits} credits)`);

// --tex 2048 for hero properties players see up close (default 1024).
execFileSync(process.execPath, ["scripts/optimize-models.mjs", rawGlb, OUT, "--texture", flag("--tex", "1024")], { stdio: "inherit" });
console.log(`in game: ${OUT}`);
