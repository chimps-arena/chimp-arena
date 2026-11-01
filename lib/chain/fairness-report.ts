/**
 * Server-only. The public record of the bonus One of One draw
 * (lib/chain/milestone.ts), shared by GET /api/mint/fairness (raw JSON) and
 * the /fairness page. A block's secret is revealed only once that block
 * has been drawn - never while it's open.
 */
import { supabaseAdmin } from "@/lib/supabase/server";
import { MILESTONE_MINT_INTERVAL } from "@/lib/chain/mint-config";
import { blockOf, blockRange, blockSecret, commitmentOf } from "@/lib/chain/milestone";

export interface FairnessBlock {
  block: number;
  mints: string;
  drawRange: string;
  commitment: string;
  /** drawing = full, draw being recorded (seconds). */
  status: "open" | "upcoming" | "drawing" | "drawn";
  /** Only once drawn. */
  secret?: string;
  closeSignature?: string;
  closeSlot?: number;
  closeBlockhash?: string;
  poolSize?: number;
  /** The draw pool (mint numbers, ascending) - the winner is pool[index]. */
  pool?: number[];
  winningMint?: number;
  winningAsset?: string;
  bonusRecipient?: string;
  /** null while the bonus mint is still being sent. */
  bonusAsset?: string | null;
}

export interface FairnessReport {
  latestMint: number;
  currentBlock: number;
  howToVerify: string;
  blocks: FairnessBlock[];
}

export const HOW_TO_VERIFY =
  "Nobody wins while a block is open. When it fills, the pool is every confirmed mint in drawRange, ascending. For a drawn block: SHA256(secret) must equal its commitment; seed = SHA256(\"winner:\" + secret + \":\" + closeBlockhash); the winner is pool[(first 12 hex digits of seed, as a number) mod poolSize]. closeBlockhash is the Solana blockhash of the slot containing closeSignature, which didn't exist while the block was open.";

interface DrawRow {
  block: number;
  mint_number: number;
  wallet: string;
  asset_address: string | null;
  winner_asset: string | null;
  close_signature: string | null;
  close_slot: number | null;
  close_blockhash: string | null;
  pool_size: number | null;
  pool: number[] | null;
}

/** null when the draw isn't configured (MILESTONE_SECRET missing). */
export async function fairnessReport(): Promise<FairnessReport | null> {
  const db = supabaseAdmin();
  const { data: last } = await db
    .from("nft_mint_claims")
    .select("mint_number")
    .not("mint_number", "is", null)
    .order("mint_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestMint = Number(last?.mint_number ?? 0);
  const currentBlock = blockOf(latestMint + 1);
  if (!blockSecret(currentBlock)) return null;

  const { data: rows } = await db
    .from("chimp_milestones")
    .select("block, mint_number, wallet, asset_address, winner_asset, close_signature, close_slot, close_blockhash, pool_size, pool");
  const draws = new Map(((rows ?? []) as DrawRow[]).filter((r) => r.close_blockhash).map((r) => [Number(r.block), r]));

  const blocks: FairnessBlock[] = [];
  for (let b = 0; b <= currentBlock + 1; b++) {
    const secret = blockSecret(b)!;
    const { lo, hi } = blockRange(b);
    const draw = draws.get(b);
    const base = {
      block: b,
      mints: `${b * MILESTONE_MINT_INTERVAL + 1}-${hi}`,
      drawRange: `${lo}-${hi}`,
      commitment: commitmentOf(secret),
    };
    if (!draw) {
      blocks.push({ ...base, status: b > currentBlock ? "upcoming" : b < currentBlock ? "drawing" : "open" });
      continue;
    }
    blocks.push({
      ...base,
      status: "drawn",
      secret,
      closeSignature: draw.close_signature!,
      closeSlot: Number(draw.close_slot),
      closeBlockhash: draw.close_blockhash!,
      poolSize: Number(draw.pool_size),
      pool: (draw.pool ?? []).map(Number),
      winningMint: Number(draw.mint_number),
      winningAsset: draw.winner_asset ?? undefined,
      bonusRecipient: draw.wallet,
      bonusAsset: draw.asset_address && draw.asset_address !== "minting" ? draw.asset_address : null,
    });
  }
  return { latestMint, currentBlock, howToVerify: HOW_TO_VERIFY, blocks };
}
