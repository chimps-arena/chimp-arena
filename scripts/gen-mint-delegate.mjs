/**
 * One-time: generates the server-held keypair that will be granted
 * UpdateDelegate access on the Astrochimps collection, so /mint can create
 * new assets inside the collection without Astro Corp co-signing every mint.
 *
 * This key is deliberately narrow: before it's granted anything, the
 * Royalties plugin is locked to authority "None" (permanently immutable) via
 * /admin/collection-authority, so even full delegate access can never touch
 * the 3%-to-Astro-Corp royalty. It can still edit other collection-level
 * metadata/plugins - keep this secret server-side only (Vercel env var),
 * same trust tier as CHIMP_MINT_AUTHORITY_SECRET / JWT_SECRET.
 *
 * It also needs a small amount of real SOL to pay the rent for each new
 * asset account it creates (a fraction of a cent per mint) - fund the
 * printed address after running this.
 *
 *   node scripts/gen-mint-delegate.mjs
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENV_PATH = new URL("../.env.local", import.meta.url);
const KEY = "MPL_CORE_MINT_DELEGATE_SECRET";

if (existsSync(ENV_PATH)) {
  const existing = readFileSync(ENV_PATH, "utf8");
  if (new RegExp(`^${KEY}=.+$`, "m").test(existing)) {
    console.error(`${KEY} already set in .env.local — not overwriting. Delete that line first if you want a fresh keypair.`);
    process.exit(1);
  }
}

const kp = Keypair.generate();
const secretB58 = bs58.encode(kp.secretKey);
const publicKey = kp.publicKey.toBase58();

const line = `\n# Astrochimps collection mint delegate - server-only, grants ability to add\n# new assets to the collection (see /admin/collection-authority). Fund with\n# a little SOL to cover asset rent.\n${KEY}=${secretB58}\n`;
writeFileSync(ENV_PATH, line, { flag: "a" });

console.log("Generated and appended to .env.local (server-only, gitignored).");
console.log("");
console.log("Public address (mint delegate):");
console.log("  " + publicKey);
console.log("");
console.log("Next:");
console.log("  1. Send a little mainnet SOL to this address (rent for new NFTs).");
console.log("  2. Add MPL_CORE_MINT_DELEGATE_SECRET to Vercel env vars too.");
console.log("  3. Go to /admin/collection-authority with the Astro Corp wallet to");
console.log("     lock the Royalties plugin and grant this address delegate access.");
