import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { MINING } from "@/lib/game/sinks";
import { utcDay } from "@/lib/game/config";
import type { MiningStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> MiningStatus for the session wallet - how many paid permits are
 * ready to use, whether a run can resume, and today's start count against
 * the daily cap. Guests (no real wallet) can't mine at all.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { realWallet: false, toolTier: 0, permitPriceChimp: MINING.permitPriceChimp, permits: { unstarted: 0, resumable: false, startedToday: 0, dailyCap: MINING.dailyPermitCap } } satisfies MiningStatus,
    );
  }

  const realWallet = !session.wallet.startsWith("guest_");
  if (!realWallet) {
    return NextResponse.json(
      { realWallet: false, toolTier: 0, permitPriceChimp: MINING.permitPriceChimp, permits: { unstarted: 0, resumable: false, startedToday: 0, dailyCap: MINING.dailyPermitCap } } satisfies MiningStatus,
    );
  }

  const db = supabaseAdmin();
  const { data: player } = await db
    .from("players")
    .select("mining_tool")
    .eq("wallet", session.wallet)
    .maybeSingle();

  const day = utcDay();
  const { data: permits } = await db
    .from("mining_permits")
    .select("started_at, submitted_at, start_day")
    .eq("wallet", session.wallet);

  const rows = permits ?? [];
  const unstarted = rows.filter((p) => !p.started_at).length;
  const resumable = rows.some(
    (p) =>
      p.started_at &&
      !p.submitted_at &&
      Date.now() - new Date(p.started_at).getTime() < MINING.resumeWindowSec * 1000,
  );
  const startedToday = rows.filter((p) => p.start_day === day).length;

  return NextResponse.json({
    realWallet: true,
    toolTier: player?.mining_tool ?? 0,
    permitPriceChimp: MINING.permitPriceChimp,
    permits: { unstarted, resumable, startedToday, dailyCap: MINING.dailyPermitCap },
  } satisfies MiningStatus);
}
