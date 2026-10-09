import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { MINING } from "@/lib/game/sinks";
import { CHIMP_DECIMALS } from "@/lib/chain/mint-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?tier=1|2 -> { tier, requires, chimpCostBase, chimpCost }
 *
 * Read-only price preview - calls pool_price() (a stable, non-mutating SQL
 * function) per resource rather than pool_buy(), so just looking at a
 * quote never moves the market. The actual purchase (POST /api/mining/tool)
 * re-quotes at execution time via pool_buy, since price can move between
 * a client fetching this and actually paying.
 */
export async function GET(req: Request) {
  const tierParam = new URL(req.url).searchParams.get("tier");
  const tier = tierParam === "1" ? 1 : tierParam === "2" ? 2 : null;
  if (!tier) {
    return NextResponse.json({ error: "tier must be 1 or 2" }, { status: 400 });
  }

  const requires = MINING.tools[tier];
  const db = supabaseAdmin();

  let totalBase = 0n;
  for (const resource of ["cobalt", "palladium", "crystal"] as const) {
    const qty = requires[resource];
    if (qty <= 0) continue;
    const { data: priceBase, error } = await db.rpc("pool_price", { p_resource: resource });
    if (error || typeof priceBase !== "number") {
      return NextResponse.json({ error: "could not price the market" }, { status: 500 });
    }
    totalBase += BigInt(priceBase) * BigInt(qty);
  }

  return NextResponse.json({
    tier,
    requires,
    chimpCostBase: totalBase.toString(),
    chimpCost: Number(totalBase) / 10 ** CHIMP_DECIMALS,
  });
}
