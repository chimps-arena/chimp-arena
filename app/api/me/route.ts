import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { crewBySlug } from "@/lib/game/config";
import { todayStatus } from "@/lib/game/status";
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
  };
  return NextResponse.json(payload);
}
