import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST { propertyId, priceChimp } -> { ok, property }
 * List (priceChimp > 0) or delist (priceChimp null/0) a property you own.
 * No payment here - this only sets the ask price. Buying is
 * POST /api/market/resale/claim.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { propertyId?: unknown; priceChimp?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { propertyId } = body;
  if (typeof propertyId !== "string") {
    return NextResponse.json({ error: "missing propertyId" }, { status: 400 });
  }

  const delist = body.priceChimp == null || body.priceChimp === 0;
  let priceChimp: number | null = null;
  if (!delist) {
    if (
      typeof body.priceChimp !== "number" ||
      !Number.isFinite(body.priceChimp) ||
      body.priceChimp <= 0
    ) {
      return NextResponse.json(
        { error: "priceChimp must be a positive number" },
        { status: 400 },
      );
    }
    priceChimp = Math.floor(body.priceChimp);
  }

  const db = supabaseAdmin();
  const { data: property } = await db
    .from("properties")
    .select("id, owner_wallet, metadata_uri")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "unknown property" }, { status: 404 });
  }
  if (property.metadata_uri) {
    return NextResponse.json(
      {
        error:
          "this is a real NFT now - resell it on a marketplace that supports the collection, not here",
      },
      { status: 409 },
    );
  }
  if (property.owner_wallet !== session.wallet) {
    return NextResponse.json(
      { error: "you don't own this property" },
      { status: 403 },
    );
  }

  const { data: updated, error } = await db
    .from("properties")
    .update({
      resale_price: priceChimp,
      resale_listed_at: priceChimp ? new Date().toISOString() : null,
    })
    .eq("id", propertyId)
    .eq("owner_wallet", session.wallet)
    .select("id, resale_price, resale_listed_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, property: updated });
}
