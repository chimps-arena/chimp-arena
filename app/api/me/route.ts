import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { crewBySlug, validateHandle } from "@/lib/game/config";
import { todayStatus } from "@/lib/game/status";
import {
  currentWeekStart,
  projectedWeeklyChimp,
  nextStreakMilestone,
} from "@/lib/game/economy";
import { utcDay } from "@/lib/game/config";
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
    .select(
      "wallet, handle, crew_slug, xp, created_at, streak_count, streak_best, last_active_day",
    )
    .eq("wallet", session.wallet)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ player: null, crew: null }, { status: 200 });
  }

  const today = await todayStatus(session.wallet);
  const db = supabaseAdmin();

  // This week's live XP split, for the "projected CHIMP" figure.
  const weekStart = currentWeekStart();
  const { data: weekRows } = await db
    .from("weekly_xp_live")
    .select("wallet, xp_earned")
    .eq("week_start", weekStart);
  const rows = weekRows ?? [];
  const poolXp = rows.reduce((s, r) => s + (r.xp_earned ?? 0), 0);
  const myWeekXp = rows.find((r) => r.wallet === session.wallet)?.xp_earned ?? 0;

  // Frozen, unclaimed allocations from past weeks (ROADMAP.md #34-36).
  const { data: allocRows } = await db
    .from("weekly_allocations")
    .select("week_start, chimp_amount")
    .eq("wallet", session.wallet)
    .is("claimed_at", null);
  const claimableWeeks = (allocRows ?? []).map((r) => ({
    weekStart: r.week_start as string,
    chimpBaseUnits: String(r.chimp_amount),
  }));
  const claimableTotal = claimableWeeks
    .reduce((s, w) => s + BigInt(w.chimpBaseUnits), 0n)
    .toString();

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
      projectedChimp: projectedWeeklyChimp(myWeekXp, poolXp, weekStart),
    },
    rewards: {
      claimableBaseUnits: claimableTotal,
      weeks: claimableWeeks,
    },
    streak: (() => {
      const count = row.streak_count ?? 0;
      const playedToday = row.last_active_day === utcDay();
      return {
        count,
        best: row.streak_best ?? 0,
        playedToday,
        atRisk: count > 0 && !playedToday,
        nextMilestone: nextStreakMilestone(count),
      };
    })(),
  };
  return NextResponse.json(payload);
}

/**
 * PATCH { handle } -> { ok, handle }
 * Rename the current player. Case-insensitive uniqueness is enforced here
 * (no DB constraint yet; a citext unique index is the future hardening).
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawHandle: unknown;
  try {
    ({ handle: rawHandle } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof rawHandle !== "string") {
    return NextResponse.json({ error: "handle required" }, { status: 400 });
  }

  const v = validateHandle(rawHandle);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: clash } = await db
    .from("players")
    .select("wallet")
    .ilike("handle", v.handle)
    .neq("wallet", session.wallet)
    .limit(1);
  if (clash && clash.length > 0) {
    return NextResponse.json({ error: "That handle is taken." }, { status: 409 });
  }

  const { error } = await db
    .from("players")
    .update({ handle: v.handle })
    .eq("wallet", session.wallet);
  if (error) {
    return NextResponse.json(
      { error: "db error", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, handle: v.handle });
}
