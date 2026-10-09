import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { signShortLived } from "@/lib/auth/jwt";
import { missionBySlug, seededShuffle, utcDay } from "@/lib/game/config";
import { TRIVIA_BANK, questionsForDay } from "@/lib/game/trivia";
import { supabaseAdmin } from "@/lib/supabase/server";
import { MINING } from "@/lib/game/sinks";
import { OXYGEN_SEC } from "@/lib/game/mining";

export const runtime = "nodejs";

const START_AUD = "chimp-arena:start";

/**
 * POST /api/missions/:slug/start
 *  -> { startToken, questions? }
 *
 * The startToken is a signed, short-lived JWT that pins { wallet, slug, iat }.
 * /submit uses `iat` to bound how fast a score could plausibly be produced, and
 * for trivia the token also carries the server-side answer key.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;
  const mission = missionBySlug(slug);
  if (!mission) return NextResponse.json({ error: "unknown mission" }, { status: 404 });

  const day = utcDay();
  const sat = Math.floor(Date.now() / 1000);

  if (mission.type === "mining") {
    if (session.wallet.startsWith("guest_")) {
      return NextResponse.json({ error: "mining needs a real wallet" }, { status: 403 });
    }
    const db = supabaseAdmin();
    const { data, error } = await db
      .rpc("start_mining_permit", {
        p_wallet: session.wallet,
        p_day: day,
        p_daily_cap: MINING.dailyPermitCap,
        p_resume_window_sec: MINING.resumeWindowSec,
      })
      .maybeSingle<{ id: string; sat: number; seed: number; tool_tier: number }>();

    if (error || !data) {
      if (error && /no_permit/.test(error.message)) {
        return NextResponse.json({ error: "Buy a permit first.", needsPermit: true }, { status: 402 });
      }
      if (error && /daily_cap/.test(error.message)) {
        return NextResponse.json({ error: "Daily mining cap reached - come back tomorrow." }, { status: 429 });
      }
      return NextResponse.json({ error: error?.message ?? "could not start" }, { status: 500 });
    }

    const startToken = await signShortLived(
      {
        wallet: session.wallet,
        slug,
        sat: data.sat,
        data: { permitId: data.id, seed: data.seed, toolTier: data.tool_tier },
      },
      START_AUD,
      "15m",
    );
    return NextResponse.json({
      startToken,
      seed: data.seed,
      toolTier: data.tool_tier,
      oxygenSec: OXYGEN_SEC,
    });
  }

  if (mission.type === "trivia") {
    const order = seededShuffle(
      TRIVIA_BANK.map((q) => q.id),
      `trivia:${day}:${session.wallet}`,
    );
    const picked = questionsForDay(order, 5);
    const startToken = await signShortLived(
      {
        wallet: session.wallet,
        slug,
        sat,
        data: { key: picked.map((q) => q.answer), ids: picked.map((q) => q.id) },
      },
      START_AUD,
      "15m",
    );
    return NextResponse.json({
      startToken,
      questions: picked.map((q) => ({ id: q.id, q: q.q, choices: q.choices })),
    });
  }

  const startToken = await signShortLived(
    { wallet: session.wallet, slug, sat },
    START_AUD,
    "15m",
  );
  return NextResponse.json({ startToken });
}
