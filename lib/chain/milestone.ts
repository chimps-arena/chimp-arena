/**
 * Server-only. The bonus One of One draw, provably fair.
 *
 * It used to land on every 1000th mint, which anyone counting mints
 * on-chain could time. Now each block of MILESTONE_MINT_INTERVAL mints
 * (block 0 = mints 1-1000) has a secret winning number:
 *
 *   blockSecret(b) = HMAC-SHA256(MILESTONE_SECRET, "astrochimpz-milestone:" + b)
 *   winning mint   = lo + (first 12 hex of SHA256("winner:" + blockSecret) mod span)
 *
 * The bonus goes to the first confirmed mint numbered at or after that
 * winner (mint numbers are handed out at prepare, so the exact one can be
 * abandoned); chimp_milestones' unique `block` (migration 0035) keeps it to
 * one per block. GET /api/mint/fairness publishes SHA256(blockSecret) for
 * every block up front and reveals blockSecret once the block is over, so
 * anyone can recompute the winner and see it was never moved. Revealing one
 * block's secret says nothing about the others.
 *
 * MILESTONE_SECRET must never change once mints have used it.
 */
import { createHash, createHmac } from "crypto";
import { MILESTONE_MINT_INTERVAL } from "@/lib/chain/mint-config";
import type { supabaseAdmin } from "@/lib/supabase/server";

type Db = ReturnType<typeof supabaseAdmin>;

/** Block 0 was already ~100 mints in when the random draw went live
 *  (2026-10-31), so its winner is drawn from here up. */
export const FIRST_RANDOM_MINT = 150;

export const blockOf = (mintNumber: number) => Math.floor((mintNumber - 1) / MILESTONE_MINT_INTERVAL);

export function blockRange(block: number): { lo: number; hi: number } {
  const start = block * MILESTONE_MINT_INTERVAL + 1;
  return { lo: block === 0 ? FIRST_RANDOM_MINT : start, hi: (block + 1) * MILESTONE_MINT_INTERVAL };
}

/** null when MILESTONE_SECRET isn't configured - then nobody wins, safely. */
export function blockSecret(block: number): string | null {
  const master = process.env.MILESTONE_SECRET;
  if (!master || master.length < 32) return null;
  return createHmac("sha256", master).update(`astrochimpz-milestone:${block}`).digest("hex");
}

export const commitmentOf = (secret: string) => createHash("sha256").update(secret).digest("hex");

/** Recomputable by anyone from the revealed block secret. */
export function winningMintFor(block: number, secret: string): number {
  const { lo, hi } = blockRange(block);
  const r = parseInt(createHash("sha256").update(`winner:${secret}`).digest("hex").slice(0, 12), 16);
  return lo + (r % (hi - lo + 1));
}

/**
 * Claims this block's bonus for `mintNumber` if it has reached the secret
 * winner and nobody has claimed the block yet. true = go mint the bonus;
 * call releaseMilestone if that then fails, so the next mint can win.
 */
export async function reserveMilestone(db: Db, mintNumber: number, wallet: string): Promise<boolean> {
  const block = blockOf(mintNumber);
  const secret = blockSecret(block);
  if (!secret) {
    console.error("MILESTONE_SECRET is not set - bonus One of One draws are off");
    return false;
  }
  if (mintNumber < winningMintFor(block, secret)) return false;
  const { error } = await db.from("chimp_milestones").insert({ mint_number: mintNumber, wallet, block });
  if (error) {
    // 23505: this block (or this mint) already has its bonus.
    if (error.code !== "23505") console.error("milestone reserve failed", { mintNumber }, error);
    return false;
  }
  return true;
}

/** Frees a reservation whose bonus mint never happened. */
export async function releaseMilestone(db: Db, mintNumber: number): Promise<void> {
  await db.from("chimp_milestones").delete().eq("mint_number", mintNumber).is("asset_address", null);
}
