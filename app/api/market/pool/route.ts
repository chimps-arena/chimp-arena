import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CHIMP_DECIMALS } from "@/lib/chain/mint-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> { pools: [{ resource, reserve, initialReserve, price }] }
 * Live pool state for the market dashboard - read-only, no trading UI here
 * anymore (buying a tool is what actually trades against the pool, see
 * components/mining/tool-shop.tsx).
 */
export async function GET() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("resource_pools")
    .select("resource, reserve, initial_reserve, base_price_base")
    .order("resource");

  const pools = (data ?? []).map((p) => {
    const priceBase =
      (BigInt(p.base_price_base) * BigInt(p.initial_reserve)) / BigInt(Math.max(p.reserve, 1));
    return {
      resource: p.resource as "cobalt" | "palladium" | "crystal",
      reserve: p.reserve,
      initialReserve: p.initial_reserve,
      price: Number(priceBase) / 10 ** CHIMP_DECIMALS,
    };
  });

  return NextResponse.json({ pools });
}
