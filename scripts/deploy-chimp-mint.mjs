/**
 * Deploys the devnet $CHIMP SPL mint and pre-mints the full fixed supply to
 * a treasury token account, per TOKEN-POLICY.md (spend-only, no player
 * emission - the whole supply exists from day one).
 *
 *   node scripts/deploy-chimp-mint.mjs
 *
 * Requires CHIMP_MINT_AUTHORITY_SECRET in .env.local (run
 * gen-mint-authority.mjs first). Idempotent-safe: refuses to run again once
 * NEXT_PUBLIC_CHIMP_MINT_ADDRESS is already set.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import bs58 from "bs58";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENV_PATH = new URL("../.env.local", import.meta.url);
// Match the real mainnet $CHIMP mint exactly:
//   21ZDgkJ9ULqLoGyHMskAfwVwrx6oixWzxxENu59HHoBV - 9 decimals, 1B fixed supply.
const DECIMALS = 9;
const MAX_SUPPLY = 1_000_000_000n; // whole tokens - TOKEN-POLICY.md

function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    console.error(".env.local not found.");
    process.exit(1);
  }
  const text = readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();

if (env.NEXT_PUBLIC_CHIMP_MINT_ADDRESS) {
  console.error(
    `Already deployed: NEXT_PUBLIC_CHIMP_MINT_ADDRESS=${env.NEXT_PUBLIC_CHIMP_MINT_ADDRESS}. ` +
      "Delete that line from .env.local if you really want a fresh mint.",
  );
  process.exit(1);
}

const secret = env.CHIMP_MINT_AUTHORITY_SECRET;
if (!secret) {
  console.error(
    "CHIMP_MINT_AUTHORITY_SECRET not set - run: node scripts/gen-mint-authority.mjs",
  );
  process.exit(1);
}

const authority = Keypair.fromSecretKey(bs58.decode(secret));
const rpc = env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");

console.log("Authority:", authority.publicKey.toBase58());
console.log("RPC:", rpc);

// ---------- 1. ensure funded ----------
let bal = await connection.getBalance(authority.publicKey);
console.log(`Balance: ${bal / LAMPORTS_PER_SOL} SOL`);

if (bal < 0.3 * LAMPORTS_PER_SOL) {
  console.log("Requesting a devnet airdrop...");
  try {
    const sig = await connection.requestAirdrop(
      authority.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
      "confirmed",
    );
    bal = await connection.getBalance(authority.publicKey);
    console.log(`New balance: ${bal / LAMPORTS_PER_SOL} SOL`);
  } catch (e) {
    console.error("Airdrop failed (devnet faucet is often rate-limited):", e.message);
    console.error(
      `Fund manually at https://faucet.solana.com -> ${authority.publicKey.toBase58()}, then re-run this script.`,
    );
    process.exit(1);
  }
}

if (bal < 0.05 * LAMPORTS_PER_SOL) {
  console.error("Still not enough SOL to deploy. Fund manually and re-run.");
  process.exit(1);
}

// ---------- 2. create the mint ----------
console.log("Creating the $CHIMP mint (6 decimals, no freeze authority)...");
const mint = await createMint(
  connection,
  authority, // payer
  authority.publicKey, // mint authority
  null, // freeze authority - none, per TOKEN-POLICY.md
  DECIMALS,
);
console.log("Mint address:", mint.toBase58());

// ---------- 3. pre-mint the full fixed supply to a treasury account ----------
console.log("Creating the treasury token account...");
const treasuryAta = await getOrCreateAssociatedTokenAccount(
  connection,
  authority,
  mint,
  authority.publicKey,
);

const amountBaseUnits = MAX_SUPPLY * 10n ** BigInt(DECIMALS);
console.log(`Minting the full fixed supply: ${MAX_SUPPLY.toLocaleString()} CHIMP...`);
await mintTo(connection, authority, mint, treasuryAta.address, authority, amountBaseUnits);

console.log("");
console.log("Done.");
console.log("  Mint address:      ", mint.toBase58());
console.log("  Treasury token acct:", treasuryAta.address.toBase58());
console.log("  Supply minted:      ", MAX_SUPPLY.toLocaleString(), "CHIMP");

// ---------- 4. persist ----------
const append =
  `\nNEXT_PUBLIC_CHIMP_MINT_ADDRESS=${mint.toBase58()}\n` +
  `CHIMP_TREASURY_TOKEN_ACCOUNT=${treasuryAta.address.toBase58()}\n`;
writeFileSync(ENV_PATH, append, { flag: "a" });
console.log("\nSaved NEXT_PUBLIC_CHIMP_MINT_ADDRESS + CHIMP_TREASURY_TOKEN_ACCOUNT to .env.local");
console.log(
  "\nReminder: mint authority is a devnet-only keypair. Move to a Squads vault " +
    "(or revoke mint authority entirely, since the full supply is already minted) before mainnet.",
);
