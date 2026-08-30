import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  allocationFor,
  currentWeekStart,
  previousWeekStart,
  toBaseUnits,
  weekIndexOf,
  weeklyPool,
} from "@/lib/game/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/rewards/freeze   (cron / admin only)
 *   Header: x-cron-secret: $CRON_SECRET
 *   Body (optional): { "weekStart": "YYYY-MM-DD" }  — defaults to last full week
 *
 * Freezes weekly_scores for the target week, computes each wallet's $CHIMP
 * (pro-rata by XP, capped per ECONOMY.md §21), and writes weekly_pools +
 * weekly_allocations. The Merkle root + on-chain distributor are attached
 * later (ROADMAP.md #33).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { weekStart?: unknown };
  const weekStart =
    typeof body.weekStart === "string"
      ? body.weekStart
      : previousWeekStart(currentWeekStart());

  const db = supabaseAdmin();

  const { error: freezeErr } = await db.rpc("freeze_week", {
    p_week_start: weekStart,
  });
  if (freezeErr) {
    return NextResponse.json(
      { error: "freeze_week failed", detail: freezeErr.message },
      { status: 500 },
    );
  }

  const { data: scores, error: scoreErr } = await db
    .from("weekly_scores")
    .select("wallet, xp_earned")
    .eq("week_start", weekStart)
    .order("wallet", { ascending: true });
  if (scoreErr) {
    return NextResponse.json(
      { error: "read scores failed", detail: scoreErr.message },
      { status: 500 },
    );
  }

  const list = (scores ?? []).filter((r) => (r.xp_earned ?? 0) > 0);
  const weekIndex = weekIndexOf(weekStart);
  const poolBase = toBaseUnits(weeklyPool(weekIndex));
  const totalXp = list.reduce((s, r) => s + (r.xp_earned ?? 0), 0);

  const { error: poolErr } = await db.from("weekly_pools").upsert(
    {
      week_start: weekStart,
      week_index: weekIndex,
      pool_amount: poolBase.toString(),
      total_xp: totalXp,
    },
    { onConflict: "week_start" },
  );
  if (poolErr) {
    return NextResponse.json(
      { error: "weekly_pools upsert failed", detail: poolErr.message },
      { status: 500 },
    );
  }

  const allocations = list.map((r, i) => ({
    wallet: r.wallet as string,
    week_start: weekStart,
    xp_earned: r.xp_earned ?? 0,
    chimp_amount: allocationFor(
      r.xp_earned ?? 0,
      totalXp,
      poolBase,
    ).toString(),
    merkle_index: i,
  }));

  if (allocations.length > 0) {
    const { error: allocErr } = await db
      .from("weekly_allocations")
      .upsert(allocations, { onConflict: "wallet,week_start" });
    if (allocErr) {
      return NextResponse.json(
        { error: "weekly_allocations upsert failed", detail: allocErr.message },
        { status: 500 },
      );
    }
  }

  const distributed = allocations.reduce(
    (s, a) => s + BigInt(a.chimp_amount),
    0n,
  );

  return NextResponse.json({
    ok: true,
    weekStart,
    weekIndex,
    players: allocations.length,
    poolBaseUnits: poolBase.toString(),
    distributedBaseUnits: distributed.toString(),
    undistributedBaseUnits: (poolBase - distributed).toString(),
    merkleRoot: null,
    note: "Merkle root + on-chain distributor pending (roadmap #33).",
  });
}
