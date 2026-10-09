import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> { gold, resources, ledger }
 * Gold + the 3 mining resources, plus a combined recent-activity feed
 * (gold_ledger and resource_ledger merged and re-sorted) for Safu Bank.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: player } = await db
    .from("players")
    .select("gold, cobalt, palladium, crystal")
    .eq("wallet", session.wallet)
    .maybeSingle();

  const [{ data: goldLedger }, { data: resourceLedger }] = await Promise.all([
    db
      .from("gold_ledger")
      .select("id, delta, reason, created_at")
      .eq("wallet", session.wallet)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("resource_ledger")
      .select("id, resource, delta, reason, created_at")
      .eq("wallet", session.wallet)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const combined = [
    ...(goldLedger ?? []).map((r) => ({
      id: `gold-${r.id}`,
      resource: "gold" as const,
      delta: r.delta,
      reason: r.reason,
      createdAt: r.created_at,
    })),
    ...(resourceLedger ?? []).map((r) => ({
      id: `${r.resource}-${r.id}`,
      resource: r.resource as "cobalt" | "palladium" | "crystal",
      delta: r.delta,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return NextResponse.json({
    gold: player?.gold ?? 0,
    resources: {
      cobalt: player?.cobalt ?? 0,
      palladium: player?.palladium ?? 0,
      crystal: player?.crystal ?? 0,
    },
    ledger: combined,
  });
}
