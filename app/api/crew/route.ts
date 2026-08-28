import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CREWS, crewBySlug } from "@/lib/game/config";

export const runtime = "nodejs";

/**
 * POST { crewSlug } -> { ok, crewSlug }
 * Joining a crew is allowed once; switching is locked for the MVP to keep crew
 * scores meaningful. Relax later with a cooldown if desired.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let crewSlug: unknown;
  try {
    ({ crewSlug } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (typeof crewSlug !== "string" || !crewBySlug(crewSlug)) {
    return NextResponse.json(
      { error: "unknown crew", crews: CREWS.map((c) => c.slug) },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();
  const { data: player } = await db
    .from("players")
    .select("crew_slug")
    .eq("wallet", session.wallet)
    .maybeSingle();

  if (!player) return NextResponse.json({ error: "no player" }, { status: 404 });
  if (player.crew_slug) {
    return NextResponse.json(
      { error: "crew already chosen", crewSlug: player.crew_slug },
      { status: 409 },
    );
  }

  const { error } = await db
    .from("players")
    .update({ crew_slug: crewSlug })
    .eq("wallet", session.wallet)
    .is("crew_slug", null); // guard against a race

  if (error) {
    return NextResponse.json({ error: "db error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, crewSlug });
}
