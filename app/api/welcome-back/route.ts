import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { utcDay } from "@/lib/game/config";
import { welcomeBackXp } from "@/lib/game/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Welcome-back gift (devlog #28).
 *   GET  -> { eligible, xp, daysAway }   is today's gift still waiting?
 *   POST -> { awarded, xp, daysAway, totalXp }   collect it (once per UTC day)
 *
 * Not offered on the day the player was created (the new-pilot checklist
 * covers that). Days away counts from the later of the last mission played
 * and the last gift collected. Fails closed: any DB problem (e.g. migration
 * 0044 not run yet) just means no popup.
 */
type Offer = { eligible: boolean; xp: number; daysAway: number };
const NONE: Offer = { eligible: false, xp: 0, daysAway: 0 };

const dayNum = (d: string) => Math.floor(Date.parse(d + "T00:00:00Z") / 86_400_000);

async function offerFor(wallet: string, today: string): Promise<Offer> {
  const db = supabaseAdmin();
  const [{ data: player }, { data: last, error }] = await Promise.all([
    db.from("players").select("created_at, last_active_day").eq("wallet", wallet).maybeSingle(),
    db
      .from("welcome_bonuses")
      .select("day")
      .eq("wallet", wallet)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!player || error) return NONE;
  if (last?.day === today) return NONE;
  const created = String(player.created_at).slice(0, 10);
  if (created >= today) return NONE;

  const lastSeenDay = [player.last_active_day as string | null, last?.day as string | undefined, created]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)!;
  const daysAway = Math.max(1, dayNum(today) - dayNum(lastSeenDay));
  return { eligible: true, xp: welcomeBackXp(daysAway), daysAway };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(NONE);
  try {
    return NextResponse.json(await offerFor(session.wallet, utcDay()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(NONE);
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = utcDay();
  const offer = await offerFor(session.wallet, today).catch(() => NONE);
  if (!offer.eligible) return NextResponse.json({ awarded: false });

  const db = supabaseAdmin();
  // The (wallet, day) primary key is the once-a-day lock: only the request
  // that actually inserts the row adds the XP.
  const { data: inserted, error } = await db
    .from("welcome_bonuses")
    .upsert(
      { wallet: session.wallet, day: today, xp: offer.xp, days_away: offer.daysAway },
      { onConflict: "wallet,day", ignoreDuplicates: true },
    )
    .select("wallet");
  if (error || !inserted?.length) return NextResponse.json({ awarded: false });

  const { data: totalXp, error: xpErr } = await db.rpc("add_player_xp", {
    p_wallet: session.wallet,
    p_amount: offer.xp,
  });
  if (xpErr || typeof totalXp !== "number") {
    // Release the day's lock so the gift can be retried.
    await db.from("welcome_bonuses").delete().eq("wallet", session.wallet).eq("day", today);
    return NextResponse.json({ error: "could not add XP, try again" }, { status: 500 });
  }

  return NextResponse.json({ awarded: true, xp: offer.xp, daysAway: offer.daysAway, totalXp });
}
