import { NextResponse } from "next/server";
import { delegateHealth } from "@/lib/chain/delegate-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> { available, low, balanceSol }
 *
 * Whether Astrochimp and property sales can go ahead right now - the mint
 * and market pages check this before showing a buy button, so a drained
 * mint delegate shows "temporarily unavailable" instead of taking a buyer's
 * money and then failing. The balance is public on-chain anyway.
 */
export async function GET() {
  return NextResponse.json(await delegateHealth(), { headers: { "cache-control": "no-store" } });
}
