import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { MILESTONE_MINT_INTERVAL } from "@/lib/chain/mint-config";
import {
  blockOf,
  blockRange,
  blockSecret,
  commitmentOf,
  winningMintFor,
} from "@/lib/chain/milestone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> the bonus One of One draw, provably fair (lib/chain/milestone.ts).
 *
 * Every block publishes `commitment` = SHA256(blockSecret) before it
 * starts. Once a block is over its `secret` is revealed, so anyone can
 * check SHA256(secret) == commitment and recompute the winning mint.
 */
export async function GET() {
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

  if (!blockSecret(currentBlock)) {
    return NextResponse.json({ error: "draw not configured" }, { status: 503 });
  }

  const { data: awards } = await db.from("chimp_milestones").select("block, mint_number, asset_address");

  // Every finished block (revealed), the current one and the next (both
  // committed only).
  const blocks = [];
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
      ...(award ? { awardedToMint: Number(award.mint_number), bonusAsset: award.asset_address } : {}),
    });
  }

  return NextResponse.json(
    {
      latestMint,
      currentBlock,
      howToVerify:
        "For a finished block: SHA256(secret) must equal its commitment, and the winning mint is drawRange start + (the first 12 hex digits of SHA256(\"winner:\" + secret), read as a number, mod the size of drawRange). The bonus goes to the first confirmed mint at or after the winning mint.",
      blocks,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
