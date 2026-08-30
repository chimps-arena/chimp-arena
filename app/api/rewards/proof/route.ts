import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isLikelySolanaAddress } from "@/lib/auth/solana-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rewards/proof?wallet=<address>
 *
 * Returns the wallet's frozen weekly allocations with the data the on-chain
 * claim needs. `proof` is null until the Merkle tree is built (ROADMAP.md #33).
 */
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!isLikelySolanaAddress(wallet)) {
    return NextResponse.json({ error: "valid wallet required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: allocs, error } = await db
    .from("weekly_allocations")
    .select("week_start, chimp_amount, merkle_index, claimed_at")
    .eq("wallet", wallet)
    .order("week_start", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: "db error", detail: error.message },
      { status: 500 },
    );
  }

  const weekStarts = [...new Set((allocs ?? []).map((a) => a.week_start))];
  const poolByWeek = new Map<
    string,
    { merkle_root: string | null; distributor: string | null }
  >();
  if (weekStarts.length > 0) {
    const { data: pools } = await db
      .from("weekly_pools")
      .select("week_start, merkle_root, distributor")
      .in("week_start", weekStarts);
    for (const p of pools ?? []) {
      poolByWeek.set(p.week_start, {
        merkle_root: p.merkle_root ?? null,
        distributor: p.distributor ?? null,
      });
    }
  }

  const weeks = (allocs ?? []).map((r) => {
    const pool = poolByWeek.get(r.week_start);
    return {
      weekStart: r.week_start as string,
      chimpBaseUnits: String(r.chimp_amount),
      merkleIndex: r.merkle_index as number | null,
      claimed: r.claimed_at != null,
      merkleRoot: pool?.merkle_root ?? null,
      distributor: pool?.distributor ?? null,
      proof: null as string[] | null,
    };
  });

  return NextResponse.json({ wallet, weeks });
}
