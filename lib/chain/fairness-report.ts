/**
 * Server-only. The public record of the bonus One of One draw
 * (lib/chain/milestone.ts), shared by GET /api/mint/fairness (raw JSON) and
 * the /fairness page.
 */
import { supabaseAdmin } from "@/lib/supabase/server";
import { MILESTONE_MINT_INTERVAL } from "@/lib/chain/mint-config";
import { blockOf, blockRange, blockSecret, commitmentOf, winningMintFor } from "@/lib/chain/milestone";

export interface FairnessBlock {
  block: number;
  mints: string;
  drawRange: string;
  commitment: string;
  /** Only once the block is over. */
  secret?: string;
  winningMint?: number;
  awardedToMint?: number;
  bonusAsset?: string;
}

export interface FairnessReport {
  latestMint: number;
  currentBlock: number;
  howToVerify: string;
  blocks: FairnessBlock[];
}

export const HOW_TO_VERIFY =
  "For a finished block: SHA256(secret) must equal its commitment, and the winning mint is drawRange start + (the first 12 hex digits of SHA256(\"winner:\" + secret), read as a number, mod the size of drawRange). The bonus goes to the first confirmed mint at or after the winning mint.";

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

  const { data: awards } = await db.from("chimp_milestones").select("block, mint_number, asset_address");

  // Every finished block (revealed), the current one and the next (both
  // committed only).
  const blocks: FairnessBlock[] = [];
  for (let b = 0; b <= currentBlock + 1; b++) {
    const secret = blockSecret(b)!;
    const { lo, hi } = blockRange(b);
    const finished = b < currentBlock;
    const award = awards?.find((a) => Number(a.block) === b && a.asset_address);
    blocks.push({
      block: b,
      mints: `${b * MILESTONE_MINT_INTERVAL + 1}-${hi}`,
      drawRange: `${lo}-${hi}`,
      commitment: commitmentOf(secret),
      ...(finished ? { secret, winningMint: winningMintFor(b, secret) } : {}),
      ...(award ? { awardedToMint: Number(award.mint_number), bonusAsset: award.asset_address as string } : {}),
    });
  }
  return { latestMint, currentBlock, howToVerify: HOW_TO_VERIFY, blocks };
}
