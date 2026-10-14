import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { verifyShortLived } from "@/lib/auth/jwt";
import { supabaseAdmin } from "@/lib/supabase/server";
import { TOOLS } from "@/lib/game/mining";
import type { StartTokenClaims } from "@/lib/types";

export const runtime = "nodejs";

const START_AUD = "chimp-arena:start";

/**
 * POST { startToken, depth } -> { depth }
 *
 * A proof-of-progress checkpoint, pinged every few seconds while a mining
 * run is actually in progress (see components/games/mining-game.tsx). This
 * is what closes the "buy a permit, call /start, wait offline, then /submit
 * the maximum score elapsed time allows" exploit - depth can only ever
 * advance by as much real wall-clock time has passed since the *last
 * accepted ping* (bump_mining_progress, migration 0028), so there's no
 * amount of waiting that banks up a dishonest jump. /submit no longer
 * trusts the client's reported score for mining at all - it reads whatever
 * depth actually accumulated here.
 *
 * Reuses the same signed startToken /submit uses (same audience, same
 * embedded permitId/toolTier) rather than minting a separate one - a ping
 * is just a lower-stakes version of the same "prove you're this wallet,
 * doing this mission, with this tool" claim.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { startToken?: unknown; depth?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { startToken, depth } = body;
  if (
    typeof startToken !== "string" ||
    typeof depth !== "number" ||
    !Number.isFinite(depth) ||
    depth < 0
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const claims = await verifyShortLived<StartTokenClaims>(startToken, START_AUD);
  if (!claims || claims.wallet !== session.wallet || claims.slug !== "mining") {
    return NextResponse.json({ error: "invalid or expired start token" }, { status: 401 });
  }

  const permitId = claims.data?.permitId as string | undefined;
  const toolTier = (claims.data?.toolTier as number | undefined) ?? 0;
  if (!permitId) {
    return NextResponse.json({ error: "missing permit" }, { status: 422 });
  }
  const tool = TOOLS[toolTier] ?? TOOLS[0];

  const db = supabaseAdmin();
  const { data: accepted, error } = await db.rpc("bump_mining_progress", {
    p_permit_id: permitId,
    p_wallet: session.wallet,
    p_depth: Math.floor(depth),
    p_max_rows_per_sec: tool.maxRowsPerSec,
  });

  if (error || typeof accepted !== "number") {
    if (error && /no_active_permit/.test(error.message)) {
      return NextResponse.json({ error: "no active run for this permit" }, { status: 409 });
    }
    return NextResponse.json(
      { error: error?.message ?? "could not record progress" },
      { status: 500 },
    );
  }

  return NextResponse.json({ depth: accepted });
}
