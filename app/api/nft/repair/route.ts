import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { fetchAsset } from "@metaplex-foundation/mpl-core";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mintDelegateUmi } from "@/lib/chain/mint-delegate";
import { moveIntoCollection } from "@/lib/chain/collection-join";
import { ASTROCHIMPS_COLLECTION, MINT_DELEGATE } from "@/lib/chain/mint-config";
import { PROPERTIES_COLLECTION } from "@/lib/chain/property-mint-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RepairState =
  | "in_collection" // nothing to do
  | "delegate_can_move" // delegate is update authority: the server can finish it alone
  | "owner_must_hand_over" // owner is update authority: owner signs a hand-over first
  | "unknown"; // not found on-chain / some other authority - needs a look

interface RepairItem {
  asset: string;
  kind: "astrochimp" | "property";
  name: string | null;
  state: RepairState;
}

async function recordedAssets(wallet: string) {
  const db = supabaseAdmin();
  const [chimps, props] = await Promise.all([
    db.from("nft_mint_claims").select("asset_address").eq("wallet", wallet),
    db.from("property_mint_claims").select("asset_address").eq("wallet", wallet),
  ]);
  return [
    ...(chimps.data ?? []).map((r) => ({ asset: r.asset_address as string, kind: "astrochimp" as const })),
    ...(props.data ?? []).map((r) => ({ asset: r.asset_address as string, kind: "property" as const })),
  ].filter((r) => r.asset && r.asset !== "pending");
}

const collectionFor = (kind: RepairItem["kind"]) =>
  kind === "astrochimp" ? ASTROCHIMPS_COLLECTION : PROPERTIES_COLLECTION;

async function inspect(asset: string, kind: RepairItem["kind"], wallet: string): Promise<RepairItem> {
  try {
    const a = await fetchAsset(mintDelegateUmi(), umiPublicKey(asset));
    const ua = a.updateAuthority;
    const state: RepairState =
      ua.type === "Collection" && ua.address === collectionFor(kind)
        ? "in_collection"
        : ua.type === "Address" && ua.address === MINT_DELEGATE
          ? "delegate_can_move"
          : ua.type === "Address" && ua.address === wallet && a.owner === wallet
            ? "owner_must_hand_over"
            : "unknown";
    return { asset, kind, name: a.name, state };
  } catch {
    return { asset, kind, name: null, state: "unknown" };
  }
}

/**
 * GET ?wallet=<pubkey> -> { items: RepairItem[] }
 *
 * Every NFT we recorded selling to this wallet (nft_mint_claims /
 * property_mint_claims), with whether it's actually inside its official
 * collection on-chain - outside it, the locked 3% resale royalty doesn't
 * apply. Astrochimps #54-#63 ended up outside (2026-10-29, see
 * lib/chain/collection-join.ts); this is how they get fixed.
 */
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet") ?? "";
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  }
  const recorded = await recordedAssets(wallet);
  const items = await Promise.all(recorded.map((r) => inspect(r.asset, r.kind, wallet)));
  return NextResponse.json({ items });
}

/**
 * POST { wallet, asset } -> { ok, state }
 *
 * Has the mint delegate move a recorded asset into its collection. Safe to
 * leave public: it only ever acts on assets this wallet was recorded buying,
 * only into their own official collection, and the move only succeeds once
 * the delegate is the asset's update authority (for the owner-held ones,
 * the owner's own hand-over transaction from /admin/repair comes first).
 */
export async function POST(req: Request) {
  let body: { wallet?: unknown; asset?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { wallet, asset } = body;
  if (typeof wallet !== "string" || typeof asset !== "string") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const match = (await recordedAssets(wallet)).find((r) => r.asset === asset);
  if (!match) {
    return NextResponse.json({ error: "not an NFT we recorded selling to this wallet" }, { status: 404 });
  }
  const before = await inspect(asset, match.kind, wallet);
  if (before.state !== "in_collection" && before.state !== "delegate_can_move") {
    return NextResponse.json({ error: `can't move it yet (${before.state})`, state: before.state }, { status: 409 });
  }
  const ok = await moveIntoCollection(asset, collectionFor(match.kind));
  return NextResponse.json({ ok, state: ok ? "in_collection" : before.state }, { status: ok ? 200 : 500 });
}
