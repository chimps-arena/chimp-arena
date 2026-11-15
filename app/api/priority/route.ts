import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  RECHECK_COOLDOWN_MS,
  STALE_AFTER_MS,
  nextSteps,
  refreshPriorityScore,
  storedPriorityScore,
  type PriorityScore,
} from "@/lib/priority-score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (s: PriorityScore) =>
  NextResponse.json({ ...s, nextSteps: nextSteps(s.breakdown) });

/** Only real wallets have a score - guests can't hold anything on-chain. */
async function walletSession() {
  const session = await getSession();
  return session && !session.wallet.startsWith("guest_") ? session : null;
}

/**
 * GET -> the player's Priority User Score (lib/priority-score.ts), worked
 * out again from chain when it's missing or over a day old.
 */
export async function GET() {
  const session = await walletSession();
  if (!session) return NextResponse.json({ error: "wallet only" }, { status: 401 });

  const stored = await storedPriorityScore(session.wallet);
  if (stored && Date.now() - Date.parse(stored.checkedAt) < STALE_AFTER_MS) return reply(stored);
  try {
    return reply(await refreshPriorityScore(session.wallet));
  } catch {
    // RPC trouble: an old score beats none
    if (stored) return reply(stored);
    return NextResponse.json({ error: "Couldn't check the chain right now. Try again shortly." }, { status: 503 });
  }
}

/** POST -> recheck now (e.g. after buying $CHIMP), at most every 10 minutes. */
export async function POST() {
  const session = await walletSession();
  if (!session) return NextResponse.json({ error: "wallet only" }, { status: 401 });

  const stored = await storedPriorityScore(session.wallet);
  const wait = stored ? RECHECK_COOLDOWN_MS - (Date.now() - Date.parse(stored.checkedAt)) : 0;
  if (stored && wait > 0) {
    return NextResponse.json(
      { error: `Checked recently - try again in ${Math.ceil(wait / 60_000)} min.` },
      { status: 429 },
    );
  }
  try {
    return reply(await refreshPriorityScore(session.wallet));
  } catch {
    return NextResponse.json({ error: "Couldn't check the chain right now. Try again shortly." }, { status: 503 });
  }
}
