import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchOkTransaction, findTransfer } from "@/lib/chain/verify-payment";
import { ASTRO_CORP_WALLET, CHIMP_MINT } from "@/lib/chain/mint-config";
import { MINING, RESOURCE_POOL } from "@/lib/game/sinks";

export const runtime = "nodejs";

/**
 * POST { tier, signature } -> { ok, tier, chimpCostBase }
 *
 * tier 1 or 2 only. Price is read live from the pool right here (not
 * trusted from the client), the on-chain payment must cover at least that
 * amount, then one DB transaction (upgrade_mining_tool_v2) debits Gold
 * directly, buys cobalt/palladium/crystal from the pool at whatever price
 * is current AT THAT INSTANT (which can differ slightly from this route's
 * quote if someone else traded in between - the RPC re-checks the final
 * total against what was actually paid and fails clearly if price moved
 * against the buyer, rather than silently overcharging).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.wallet.startsWith("guest_")) {
    return NextResponse.json({ error: "mining needs a real wallet" }, { status: 403 });
  }

  let body: { tier?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { tier, signature } = body;
  if ((tier !== 1 && tier !== 2) || typeof signature !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const requires = MINING.tools[tier];
  const db = supabaseAdmin();

  // Circuit breaker: refuse a trade that would eat too much of any one
  // resource's pool in a single purchase, before even checking payment.
  for (const resource of ["cobalt", "palladium", "crystal"] as const) {
    const qty = requires[resource];
    if (qty <= 0) continue;
    const { data: pool } = await db
      .from("resource_pools")
      .select("reserve")
      .eq("resource", resource)
      .maybeSingle();
    if (pool && qty > pool.reserve * RESOURCE_POOL.maxTradeFractionOfReserve) {
      return NextResponse.json(
        { error: `That trade is too large for the current ${resource} market - try again once more supply is mined.` },
        { status: 409 },
      );
    }
  }

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

  let buyerPk: PublicKey;
  try {
    buyerPk = new PublicKey(session.wallet);
  } catch {
    return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  }

  const tx = await fetchOkTransaction(signature);
  if (!tx) {
    return NextResponse.json({ error: "transaction not found or failed" }, { status: 422 });
  }

  const mint = new PublicKey(CHIMP_MINT);
  const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk).toBase58();
  const astroAta = getAssociatedTokenAddressSync(mint, new PublicKey(ASTRO_CORP_WALLET)).toBase58();

  // totalBase is the quote this instant; require payment of at least a
  // slightly-tolerant threshold (98%) so a few seconds of price drift
  // between quote-display and signing doesn't reject an honest payment -
  // the RPC below still re-checks the real, final total against whatever
  // was actually paid.
  const minAcceptable = (totalBase * 98n) / 100n;
  if (minAcceptable > 0n && !findTransfer(tx, buyerAta, astroAta, minAcceptable)) {
    return NextResponse.json({ error: "payment not found in that transaction" }, { status: 422 });
  }

  const { data, error } = await db
    .rpc("upgrade_mining_tool_v2", {
      p_wallet: session.wallet,
      p_tier: tier,
      p_signature: signature,
      p_min_chimp_paid_base: totalBase,
      p_gold: requires.gold,
      p_cobalt: requires.cobalt,
      p_palladium: requires.palladium,
      p_crystal: requires.crystal,
    })
    .maybeSingle<{ tier: number; chimp_cost_base: number }>();

  if (error || !data) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "payment already used" }, { status: 409 });
    }
    if (error && /insufficient_gold/.test(error.message)) {
      return NextResponse.json(
        { error: "Not enough Gold for this tool - your payment is safe, it's safe to retry once you have enough." },
        { status: 409 },
      );
    }
    if (error && /pool_depleted/.test(error.message)) {
      return NextResponse.json(
        { error: "The market ran out of a required resource mid-purchase - your payment is safe, try again." },
        { status: 409 },
      );
    }
    if (error && /price_moved/.test(error.message)) {
      return NextResponse.json(
        { error: "Price moved before your payment landed - your payment is safe, refresh the quote and try again." },
        { status: 409 },
      );
    }
    if (error && /wrong_tier/.test(error.message)) {
      return NextResponse.json(
        { error: "You've already upgraded, or skipped a tier - your payment is safe." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error?.message ?? "upgrade failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tier: data.tier, chimpCostBase: data.chimp_cost_base });
}
