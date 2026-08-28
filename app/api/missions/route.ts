import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { todayStatus } from "@/lib/game/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET -> today's mission set with this player's completion status. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await todayStatus(session.wallet));
}
