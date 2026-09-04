/**
 * One-time: generates the devnet keypair that will hold $CHIMP mint +
 * treasury authority. Appends the secret to .env.local (server-only,
 * gitignored) and prints the public address.
 *
 *   node scripts/gen-mint-authority.mjs
 *
 * Before mainnet: create a Squads multisig and transfer authority to its
 * vault (one setAuthority instruction) — this keypair is a devnet-only
 * stopgap, per TOKEN-POLICY.md / ROADMAP.md #31-32.
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENV_PATH = new URL("../.env.local", import.meta.url);
const KEY = "CHIMP_MINT_AUTHORITY_SECRET";

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

const line = `\n# $CHIMP mint + treasury authority (devnet only — move to a Squads vault before mainnet)\n${KEY}=${secretB58}\n`;
writeFileSync(ENV_PATH, line, { flag: "a" });

console.log("Generated and appended to .env.local (server-only, gitignored).");
console.log("");
console.log("Public address (mint + treasury authority):");
console.log("  " + publicKey);
console.log("");
console.log("Next: fund this address with devnet SOL, then deploy the $CHIMP mint.");
