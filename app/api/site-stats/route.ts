import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET -> { available, astrochimpsMinted, propertiesSold, gamesPlayed, walletPlayers }
 *
 * Public, real counts for the homepage proof strip (devlog #9). Every
 * number is a plain row count from our own tables - nothing estimated or
 * padded. Cached at the CDN for 5 minutes so a traffic spike costs four
 * cheap count queries every 5 minutes, not four per visitor.
 */
export async function GET() {
  try {
    const db = supabaseAdmin();
    const head = { count: "exact" as const, head: true };
    const [chimps, props, runs, wallets] = await Promise.all([
      db.from("nft_mint_claims").select("id", head),
      db.from("property_mint_claims").select("id", head),
      db.from("mission_runs").select("id", head),
      db.from("players").select("wallet", head).not("wallet", "like", "guest_%"),
    ]);
    const err = chimps.error ?? props.error ?? runs.error ?? wallets.error;
    if (err) throw err;

    return NextResponse.json(
      {
        available: true as const,
        astrochimpsMinted: chimps.count ?? 0,
        propertiesSold: props.count ?? 0,
        gamesPlayed: runs.count ?? 0,
        walletPlayers: wallets.count ?? 0,
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ available: false as const });
  }
}
