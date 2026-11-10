// Rebuilds lib/devlog.json - the "Shipped" list on /devlog - from the git
// history of the current branch. Run before each release:
//   node scripts/make-devlog.mjs
// Commits are written "type(area): what changed"; the type becomes a plain
// label and housekeeping commits are left out.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const KIND = { feat: "New", fix: "Fix", perf: "Faster", refactor: "Rework", style: "Look" };
const AREA = {
  ui: "Site design", site: "Site", mint: "Minting", market: "Market", land: "Properties",
  images: "Images", "my-assets": "My Assets", arena: "Arena", mining: "Mining", world: "3D world",
  wallet: "Wallet", chain: "Blockchain", nft: "NFTs", web3: "Wallet", mobile: "Mobile",
  ux: "Site", rename: "Names", "chimp-balance": "Wallet",
};

const log = execFileSync("git", ["log", "--no-merges", "--format=%h%x09%ad%x09%s", "--date=short"], {
  encoding: "utf8",
});

const entries = [];
for (const line of log.trim().split("\n")) {
  const [hash, date, subject] = line.split("\t");
  const m = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/.exec(subject);
  if (!m || !KIND[m[1]]) continue;
  const areas = (m[2] ?? "").split(",").map((a) => AREA[a.trim()] ?? a.trim()).filter(Boolean);
  const text = m[3].charAt(0).toUpperCase() + m[3].slice(1);
  entries.push({ hash, date, kind: KIND[m[1]], area: [...new Set(areas)].join(", "), text });
}

writeFileSync(new URL("../lib/devlog.json", import.meta.url), JSON.stringify(entries, null, 1) + "\n");
console.log(`lib/devlog.json: ${entries.length} entries`);
