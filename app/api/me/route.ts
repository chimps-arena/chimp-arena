import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { crewBySlug } from "@/lib/game/config";
import { todayStatus } from "@/lib/game/status";
import { currentWeekStart, projectedWeeklyChimp } from "@/lib/game/economy";
import type { MeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ player: null, crew: null } satisfies Partial<MeResponse>, {
      status: 200,
    });
  }

  const { data: row } = await supabaseAdmin()
    .from("players")
    .select("wallet, handle, crew_slug, xp, created_at")
    .eq("wallet", session.wallet)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ player: null, crew: null }, { status: 200 });
  }

  const today = await todayStatus(session.wallet);

  // Pre-launch weekly $CHIMP projection. Small table for now; at P2 this
  // aggregation moves into the distributor cron (ROADMAP.md #34).
  const weekStart = currentWeekStart();
  const { data: weekRows } = await supabaseAdmin()
    .from("weekly_xp_live")
    .select("wallet, xp_earned")
    .eq("week_start", weekStart);
  const rows = weekRows ?? [];
  const poolXp = rows.reduce((s, r) => s + (r.xp_earned ?? 0), 0);
  const myWeekXp = rows.find((r) => r.wallet === session.wallet)?.xp_earned ?? 0;

  const payload: MeResponse = {
    player: {
      wallet: row.wallet,
      handle: row.handle,
      crewSlug: row.crew_slug,
      xp: row.xp,
      createdAt: row.created_at,
    },
    crew: crewBySlug(row.crew_slug),
    today,
    week: {
      start: weekStart,
      xp: myWeekXp,
      poolXp,
      projectedChimp: projectedWeeklyChimp(myWeekXp, poolXp),
    },
  };
  return NextResponse.json(payload);
}
