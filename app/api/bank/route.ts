import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> { gold, ledger }
 * Gold total + recent Gold ledger entries for the signed-in player. Safu
 * Bank's activity feed - players.gold stays the fast running total.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: player } = await db
    .from("players")
    .select("gold")
    .eq("wallet", session.wallet)
    .maybeSingle();

  const { data: ledger } = await db
    .from("gold_ledger")
    .select("id, delta, reason, created_at")
    .eq("wallet", session.wallet)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    gold: player?.gold ?? 0,
    ledger: (ledger ?? []).map((r) => ({
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  });
}
