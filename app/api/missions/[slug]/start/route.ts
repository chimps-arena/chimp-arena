import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { signShortLived } from "@/lib/auth/jwt";
import { missionBySlug, seededShuffle, utcDay } from "@/lib/game/config";
import { TRIVIA_BANK, questionsForDay } from "@/lib/game/trivia";

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
      "20m",
    );
    return NextResponse.json({
      startToken,
      questions: picked.map((q) => ({ id: q.id, q: q.q, choices: q.choices })),
    });
  }

  const startToken = await signShortLived(
    { wallet: session.wallet, slug, sat },
    START_AUD,
    "20m",
  );
  return NextResponse.json({ startToken });
}
