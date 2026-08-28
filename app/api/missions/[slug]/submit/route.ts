import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { verifyShortLived } from "@/lib/auth/jwt";
import { supabaseAdmin } from "@/lib/supabase/server";
import { missionBySlug, MISSION_RULES, utcDay } from "@/lib/game/config";
import type { StartTokenClaims, SubmitResult } from "@/lib/types";

export const runtime = "nodejs";

const START_AUD = "chimp-arena:start";

interface SubmitBody {
  startToken?: string;
  score?: number; // astro-run
  rounds?: number[]; // reaction: per-round ms
  answers?: number[]; // trivia: chosen choice indices
}

/** Derive the canonical score for a mission from the raw submission. */
function deriveScore(
  type: string,
  body: SubmitBody,
  claims: StartTokenClaims,
): { score: number } | { error: string } {
  if (type === "reaction") {
    const r = body.rounds;
    if (!Array.isArray(r) || r.length !== 5) return { error: "expected 5 rounds" };
    // 100ms is the human reaction-time floor; 5000ms is a slow but valid round.
    if (!r.every((n) => typeof n === "number" && n >= 100 && n <= 5000))
      return { error: "round out of range" };
    return { score: Math.round(r.reduce((a, b) => a + b, 0) / r.length) };
  }

  if (type === "trivia") {
    const a = body.answers;
    const key = (claims.data?.key as number[] | undefined) ?? [];
    if (!Array.isArray(a) || a.length !== key.length)
      return { error: "answer count mismatch" };
    let correct = 0;
    for (let i = 0; i < key.length; i++) if (a[i] === key[i]) correct++;
    return { score: correct };
  }

  if (type === "astro-run" || type === "dodge") {
    const s = body.score;
    if (typeof s !== "number" || !Number.isFinite(s) || s < 0)
      return { error: "bad score" };
    return { score: Math.floor(s) };
  }

  return { error: "unknown mission type" };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;
  const mission = missionBySlug(slug);
  const rule = MISSION_RULES[slug];
  if (!mission || !rule)
    return NextResponse.json({ error: "unknown mission" }, { status: 404 });

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.startToken)
    return NextResponse.json({ error: "missing startToken" }, { status: 400 });

  const claims = await verifyShortLived<StartTokenClaims>(body.startToken, START_AUD);
  if (!claims || claims.wallet !== session.wallet || claims.slug !== slug) {
    return NextResponse.json(
      { error: "invalid or expired start token - restart the mission" },
      { status: 401 },
    );
  }

  const elapsedSec = Math.floor(Date.now() / 1000) - claims.sat;
  // Defence in depth: no mission takes 15 minutes. Rejects stale-token abuse
  // (holding a start token to inflate the time-based score ceilings) and
  // clock-skew nonsense, independent of each mission's own bounds.
  if (elapsedSec < 0 || elapsedSec > 900) {
    return NextResponse.json(
      { error: "stale start token - restart the mission" },
      { status: 422 },
    );
  }

  const derived = deriveScore(mission.type, body, claims);
  if ("error" in derived)
    return NextResponse.json({ error: derived.error }, { status: 400 });

  const score = derived.score;
  if (!rule.validate(score, elapsedSec)) {
    return NextResponse.json(
      { error: "submission rejected as implausible" },
      { status: 422 },
    );
  }

  const db = supabaseAdmin();
  const day = utcDay();
  const xpForRun = rule.xp(score, mission.baseXp);

  // Once-per-UTC-day XP gate via the unique (wallet, mission_slug, day) index.
  const { data: inserted, error: insErr } = await db
    .from("mission_runs")
    .insert({
      wallet: session.wallet,
      mission_slug: slug,
      day,
      score,
      xp_awarded: xpForRun,
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    // 23505 = unique_violation -> already played today.
    if (insErr.code === "23505") {
      // Let the raw score improve for bragging rights, but award no XP.
      const { data: prev } = await db
        .from("mission_runs")
        .select("score")
        .eq("wallet", session.wallet)
        .eq("mission_slug", slug)
        .eq("day", day)
        .maybeSingle();
      const better = rule.higherIsBetter
        ? score > (prev?.score ?? -Infinity)
        : score < (prev?.score ?? Infinity);
      if (better) {
        await db
          .from("mission_runs")
          .update({ score })
          .eq("wallet", session.wallet)
          .eq("mission_slug", slug)
          .eq("day", day);
      }
      const { data: playerRow } = await db
        .from("players")
        .select("xp")
        .eq("wallet", session.wallet)
        .maybeSingle();
      const result: SubmitResult = {
        ok: true,
        xpAwarded: 0,
        totalXp: playerRow?.xp ?? 0,
        alreadyClaimedToday: true,
        scoreAccepted: score,
      };
      return NextResponse.json(result);
    }
    return NextResponse.json(
      { error: "db error", detail: insErr.message },
      { status: 500 },
    );
  }

  void inserted;
  // Atomic increment - cannot lose a concurrent write from the same wallet.
  const { data: newXp, error: updErr } = await db.rpc("add_player_xp", {
    p_wallet: session.wallet,
    p_amount: xpForRun,
  });
  if (updErr || typeof newXp !== "number") {
    return NextResponse.json(
      { error: "db error", detail: updErr?.message ?? "xp update failed" },
      { status: 500 },
    );
  }

  const result: SubmitResult = {
    ok: true,
    xpAwarded: xpForRun,
    totalXp: newXp,
    alreadyClaimedToday: false,
    scoreAccepted: score,
  };
  return NextResponse.json(result);
}
