import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { crewBySlug, validateHandle } from "@/lib/game/config";
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
