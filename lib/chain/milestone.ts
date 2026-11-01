/**
 * Server-only. The bonus One of One draw: one per block of mints, drawn
 * only AFTER the block fills (founders, 2026-11-01 - every payout comes
 * after 1,000 sales), provably fair.
 *
 * Each block of MILESTONE_MINT_INTERVAL mints (block 0 = mints 1-1000) has
 * a sealed secret
 *
 *   blockSecret(b) = HMAC-SHA256(MILESTONE_SECRET, "astrochimpz-milestone:" + b)
 *
 * whose SHA256 (its commitment) is public from the start (/fairness). Nobody
 * wins while a block is open. The first confirmed mint numbered at or past
 * the block's last number closes it, and the draw runs:
 *
 *   pool   = confirmed mints numbered drawRange lo..hi, ascending
 *            (block 0 starts at #150 - founders' call)
 *   seed   = SHA256("winner:" + blockSecret + ":" + blockhash of the closing mint's slot)
 *   winner = pool[(first 12 hex digits of seed, as a number) mod pool size]
 *
 * The closing blockhash didn't exist while the block was open, so not even
 * we could know the result in advance; the sealed secret stops anyone else
 * computing it from public data. The bonus goes to whoever holds the
 * winning Astrochimp at draw time. Once drawn, the secret is revealed so
 * anyone can recompute it.
 *
 * MILESTONE_SECRET must never change once mints have used it.
 */
import { createHash, createHmac } from "crypto";
import { Connection } from "@solana/web3.js";
import { create as createCoreAsset, fetchAsset, fetchCollection } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { chainEndpoint } from "@/lib/chain/connection";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
import { ASTROCHIMPS_COLLECTION, MILESTONE_MINT_INTERVAL } from "@/lib/chain/mint-config";
import type { supabaseAdmin } from "@/lib/supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Block 0's draw pool starts here (founders' call, 2026-11-01). */
export const FIRST_RANDOM_MINT = 150;

export const blockOf = (mintNumber: number) => Math.floor((mintNumber - 1) / MILESTONE_MINT_INTERVAL);

export function blockRange(block: number): { lo: number; hi: number } {
  const start = block * MILESTONE_MINT_INTERVAL + 1;
  return { lo: block === 0 ? FIRST_RANDOM_MINT : start, hi: (block + 1) * MILESTONE_MINT_INTERVAL };
}

/** null when MILESTONE_SECRET isn't configured - then no draws run, safely. */
export function blockSecret(block: number): string | null {
  const master = process.env.MILESTONE_SECRET;
  if (!master || master.length < 32) return null;
  return createHmac("sha256", master).update(`astrochimpz-milestone:${block}`).digest("hex");
}

export const commitmentOf = (secret: string) => createHash("sha256").update(secret).digest("hex");

/** Recomputable by anyone from the revealed secret and the closing blockhash. */
export function drawIndex(secret: string, closeBlockhash: string, poolSize: number): number {
  const seed = createHash("sha256").update(`winner:${secret}:${closeBlockhash}`).digest("hex");
  return parseInt(seed.slice(0, 12), 16) % poolSize;
}

/** Confirmed mints in a block's draw range, ascending - the draw pool. */
export async function drawPool(db: Db, block: number) {
  const { lo, hi } = blockRange(block);
  const { data, error } = await db
    .from("nft_mint_claims")
    .select("mint_number, asset_address, wallet")
    .gte("mint_number", lo)
    .lte("mint_number", hi)
    .order("mint_number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ mintNumber: Number(r.mint_number), asset: r.asset_address as string, wallet: r.wallet as string }));
}

interface DrawRow {
  block: number;
  mint_number: number;
  wallet: string;
  asset_address: string | null;
}

/**
 * Called after every recorded mint (in `after()`, so it never slows the
 * buyer down). Draws every block this mint has closed that isn't drawn yet,
 * and retries any drawn bonus whose mint failed earlier. Idempotent:
 * chimp_milestones' unique `block` means a block is only ever drawn once.
 */
export async function settleDraws(db: Db, closing: { mintNumber: number; signature: string }): Promise<void> {
  const n = closing.mintNumber;
  const lastClosed = n >= blockRange(blockOf(n)).hi ? blockOf(n) : blockOf(n) - 1;

  const { data: rows, error } = await db.from("chimp_milestones").select("block, mint_number, wallet, asset_address");
  if (error) throw error;
  const drawn = new Map((rows as DrawRow[]).map((r) => [Number(r.block), r]));

  for (let b = 0; b <= lastClosed; b++) {
    if (!drawn.has(b)) {
      const row = await drawBlock(db, b, closing.signature);
      if (row) drawn.set(b, row);
    }
  }
  for (const row of drawn.values()) {
    if (!row.asset_address) await mintBonus(db, row);
  }
}

async function drawBlock(db: Db, block: number, closeSignature: string): Promise<DrawRow | null> {
  const secret = blockSecret(block);
  if (!secret) {
    console.error("MILESTONE_SECRET is not set - bonus draws are off");
    return null;
  }
  const pool = await drawPool(db, block);
  if (pool.length === 0) return null;

  const conn = new Connection(chainEndpoint(), "confirmed");
  const tx = await conn.getTransaction(closeSignature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  if (!tx) throw new Error(`closing transaction ${closeSignature} not found`);
  const blk = await conn.getBlock(tx.slot, {
    maxSupportedTransactionVersion: 0,
    transactionDetails: "none",
    rewards: false,
    commitment: "confirmed",
  });
  if (!blk) throw new Error(`block for slot ${tx.slot} not available`);

  const winner = pool[drawIndex(secret, blk.blockhash, pool.length)];

  // The bonus goes to whoever holds the winning Astrochimp right now; its
  // original minter if it can't be read (e.g. burned).
  let recipient = winner.wallet;
  try {
    recipient = (await fetchAsset(mintDelegateUmi(), umiPublicKey(winner.asset))).owner.toString();
  } catch {
    // keep the minter
  }

  const row = {
    block,
    mint_number: winner.mintNumber,
    wallet: recipient,
    winner_asset: winner.asset,
    close_signature: closeSignature,
    close_slot: tx.slot,
    close_blockhash: blk.blockhash,
    pool_size: pool.length,
    pool: pool.map((p) => p.mintNumber),
  };
  const { error } = await db.from("chimp_milestones").insert(row);
  if (error) {
    // 23505: another request drew this block a moment ago.
    if (error.code !== "23505") console.error("bonus draw: recording failed", { block }, error);
    return null;
  }
  console.log("bonus draw", { block, winningMint: winner.mintNumber, recipient, poolSize: pool.length });
  return { block, mint_number: winner.mintNumber, wallet: recipient, asset_address: null };
}

/** asset_address while a bonus mint is in flight - claims it so two
 *  concurrent requests can't both mint the same block's bonus. */
const MINTING = "minting";

/** Delegate-paid (one per 1,000 mints - not worth a buyer-signed transaction). */
async function mintBonus(db: Db, row: DrawRow): Promise<void> {
  const { data: claimed } = await db
    .from("chimp_milestones")
    .update({ asset_address: MINTING })
    .eq("block", row.block)
    .is("asset_address", null)
    .select("block")
    .maybeSingle();
  if (!claimed) return;
  try {
    const { data: variants } = await db.from("chimp_variants").select("id, name");
    if (!variants || variants.length === 0) {
      console.error("bonus draw: no One of One designs to award", { block: row.block });
      await db.from("chimp_milestones").update({ asset_address: null }).eq("block", row.block);
      return;
    }
    const variant = variants[Math.floor(Math.random() * variants.length)];
    const umi = mintDelegateUmi();
    const collection = await fetchCollection(umi, umiPublicKey(ASTROCHIMPS_COLLECTION));
    const asset = generateSigner(umi);
    await createCoreAsset(umi, {
      asset,
      name: variant.name,
      uri: `${SITE_URL}/nft/chimp-metadata/${variant.id}`,
      collection,
      owner: umiPublicKey(row.wallet),
      // Explicit - an omitted authority becomes a non-signer placeholder.
      authority: umi.identity,
    }).sendAndConfirm(umi, { send: { maxRetries: 5 }, confirm: { commitment: "confirmed" } });
    const { error } = await db
      .from("chimp_milestones")
      .update({ variant_id: variant.id, asset_address: asset.publicKey.toString() })
      .eq("block", row.block);
    if (error) console.error("bonus draw: minted but not recorded - record by hand", { row, asset: asset.publicKey.toString() }, error);
  } catch (e) {
    // Released so the next recorded mint retries it. (A crash between the
    // mint landing and this point leaves "minting" behind - logged, fix by hand.)
    console.error("bonus draw: minting the bonus failed, will retry", { block: row.block }, e);
    await db.from("chimp_milestones").update({ asset_address: null }).eq("block", row.block).eq("asset_address", MINTING);
  }
}
