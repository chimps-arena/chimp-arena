import { NextResponse } from "next/server";
import { fairnessReport } from "@/lib/chain/fairness-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET -> the bonus One of One draw, provably fair (lib/chain/milestone.ts),
 * as raw JSON. The /fairness page shows the same thing for people.
 *
 * Every block publishes `commitment` = SHA256(blockSecret) before it
 * starts. Once a block is over its `secret` is revealed, so anyone can
 * check SHA256(secret) == commitment and recompute the winning mint.
 */
export async function GET() {
  const report = await fairnessReport();
  if (!report) {
    return NextResponse.json({ error: "draw not configured" }, { status: 503 });
  }
  return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
}
