import { NextResponse } from "next/server";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { crewBySlug, validateHandle } from "@/lib/game/config";
import { PUBLIC_ENV } from "@/lib/env";
import {
  ASTRO_CORP_WALLET,
  CHIMP_MINT,
  RENAME_COOLDOWN_DAYS,
  RENAME_FREE_TRIAL_DAYS,
  RENAME_PRICE_BASE,
  RENAME_PRICE_CHIMP,
} from "@/lib/chain/mint-config";
import { todayStatus } from "@/lib/game/status";
import {
  currentWeekStart,
  projectedWeeklyChimp,
  nextStreakMilestone,
} from "@/lib/game/economy";
import { utcDay } from "@/lib/game/config";
import { computeRank } from "@/lib/game/ranks";
import type { MeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ player: null, crew: null } satisfies Partial<MeResponse>, {
      status: 200,
    });
  }

  const { data: row } = await supabaseAdmin()
    .from("players")
    .select(
      "wallet, handle, crew_slug, xp, gold, created_at, last_renamed_at, streak_count, streak_best, last_active_day",
    )
    .eq("wallet", session.wallet)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ player: null, crew: null }, { status: 200 });
  }

  const today = await todayStatus(session.wallet);
  const db = supabaseAdmin();

  // This week's live XP split, for the "projected CHIMP" figure.
  const weekStart = currentWeekStart();
  const { data: weekRows } = await db
    .from("weekly_xp_live")
    .select("wallet, xp_earned")
    .eq("week_start", weekStart);
  const rows = weekRows ?? [];
  const poolXp = rows.reduce((s, r) => s + (r.xp_earned ?? 0), 0);
  const myWeekXp = rows.find((r) => r.wallet === session.wallet)?.xp_earned ?? 0;

  // Frozen, unclaimed allocations from past weeks (ROADMAP.md #34-36).
  const { data: allocRows } = await db
    .from("weekly_allocations")
    .select("week_start, chimp_amount")
    .eq("wallet", session.wallet)
    .is("claimed_at", null);
  const claimableWeeks = (allocRows ?? []).map((r) => ({
    weekStart: r.week_start as string,
    chimpBaseUnits: String(r.chimp_amount),
  }));
  const claimableTotal = claimableWeeks
    .reduce((s, w) => s + BigInt(w.chimpBaseUnits), 0n)
    .toString();

  // Rank: level (from XP) + properties actually owned on the market.
  const { count: propertiesOwned } = await db
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_wallet", session.wallet);
  const rank = computeRank(row.xp, propertiesOwned ?? 0);

  const freeUntil = new Date(
    new Date(row.created_at).getTime() + RENAME_FREE_TRIAL_DAYS * 86_400_000,
  );
  const cooldownEnds = row.last_renamed_at
    ? new Date(new Date(row.last_renamed_at).getTime() + RENAME_COOLDOWN_DAYS * 86_400_000)
    : null;
  const nextAvailableAt = cooldownEnds && cooldownEnds > new Date() ? cooldownEnds : null;

  const payload: MeResponse = {
    player: {
      wallet: row.wallet,
      handle: row.handle,
      crewSlug: row.crew_slug,
      xp: row.xp,
      gold: row.gold ?? 0,
      createdAt: row.created_at,
      lastRenamedAt: row.last_renamed_at,
    },
    crew: crewBySlug(row.crew_slug),
    today,
    week: {
      start: weekStart,
      xp: myWeekXp,
      poolXp,
      projectedChimp: projectedWeeklyChimp(myWeekXp, poolXp, weekStart),
    },
    rewards: {
      claimableBaseUnits: claimableTotal,
      weeks: claimableWeeks,
    },
    streak: (() => {
      const count = row.streak_count ?? 0;
      const playedToday = row.last_active_day === utcDay();
      return {
        count,
        best: row.streak_best ?? 0,
        playedToday,
        atRisk: count > 0 && !playedToday,
        nextMilestone: nextStreakMilestone(count),
      };
    })(),
    rank: {
      name: rank.current.name,
      index: rank.current.index,
      unlocks: rank.current.unlocks,
      next: rank.next
        ? {
            name: rank.next.name,
            minLevel: rank.next.minLevel,
            minProperties: rank.next.minProperties,
          }
        : null,
      level: rank.level,
      propertiesOwned: rank.propertiesOwned,
    },
    rename: {
      freeUntil: freeUntil.toISOString(),
      nextAvailableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
      priceChimp: RENAME_PRICE_CHIMP,
    },
  };
  return NextResponse.json(payload);
}

const endpoint =
  PUBLIC_ENV.solanaRpc ||
  clusterApiUrl(
    (PUBLIC_ENV.solanaCluster === "mainnet-beta"
      ? "mainnet-beta"
      : "devnet") as "mainnet-beta" | "devnet",
  );
const conn = new Connection(endpoint, "confirmed");

/**
 * PATCH { handle, signature? } -> { ok, handle }
 *
 * Rename the current player. Free for RENAME_FREE_TRIAL_DAYS after the
 * account was created; after that, needs a verified RENAME_PRICE_CHIMP
 * payment to Astro Corp (signature = the buyer's own transfer, same
 * verify-then-act pattern as /api/mint/claim - no signature needed at all
 * while still inside the free trial). Either way, a rename (free or paid)
 * starts a RENAME_COOLDOWN_DAYS lockout before the next one.
 *
 * Case-insensitive uniqueness is enforced here (no DB constraint yet; a
 * citext unique index is the future hardening).
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { handle?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { handle: rawHandle, signature } = body;
  if (typeof rawHandle !== "string") {
    return NextResponse.json({ error: "handle required" }, { status: 400 });
  }
  if (signature !== undefined && typeof signature !== "string") {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const v = validateHandle(rawHandle);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: player } = await db
    .from("players")
    .select("handle, created_at, last_renamed_at")
    .eq("wallet", session.wallet)
    .maybeSingle();
  if (!player) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (v.handle === player.handle) {
    return NextResponse.json({ ok: true, handle: v.handle });
  }

  const now = Date.now();
  if (player.last_renamed_at) {
    const cooldownEnds =
      new Date(player.last_renamed_at).getTime() + RENAME_COOLDOWN_DAYS * 86_400_000;
    if (now < cooldownEnds) {
      return NextResponse.json(
        {
          error: `You can rename again ${new Date(cooldownEnds).toLocaleDateString()}.`,
          nextAvailableAt: new Date(cooldownEnds).toISOString(),
        },
        { status: 429 },
      );
    }
  }

  const freeUntil = new Date(player.created_at).getTime() + RENAME_FREE_TRIAL_DAYS * 86_400_000;
  const inTrial = now < freeUntil;

  if (!inTrial) {
    if (!signature) {
      return NextResponse.json(
        { error: `Your free trial has ended. Renaming now costs ${RENAME_PRICE_CHIMP} $CHIMP.` },
        { status: 402 },
      );
    }

    let buyerPk: PublicKey;
    try {
      buyerPk = new PublicKey(session.wallet);
    } catch {
      return NextResponse.json({ error: "bad wallet" }, { status: 400 });
    }

    let tx;
    try {
      tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
    } catch {
      return NextResponse.json({ error: "bad signature" }, { status: 400 });
    }
    if (!tx || tx.meta?.err) {
      return NextResponse.json(
        { error: "transaction not found or failed" },
        { status: 422 },
      );
    }

    const mint = new PublicKey(CHIMP_MINT);
    const buyerAta = getAssociatedTokenAddressSync(mint, buyerPk).toBase58();
    const astroAta = getAssociatedTokenAddressSync(mint, new PublicKey(ASTRO_CORP_WALLET)).toBase58();

    const paidEnough = tx.transaction.message.instructions.some((ix) => {
      if (!("parsed" in ix) || ix.program !== "spl-token") return false;
      const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> };
      if (parsed.type !== "transfer" && parsed.type !== "transferChecked") return false;
      const info = parsed.info ?? {};
      if (info.destination !== astroAta || info.source !== buyerAta) return false;
      const raw = BigInt(
        (info.tokenAmount as { amount?: string } | undefined)?.amount ??
          (info.amount as string | undefined) ??
          "0",
      );
      return raw >= RENAME_PRICE_BASE;
    });
    if (!paidEnough) {
      return NextResponse.json(
        { error: "payment not found in that transaction" },
        { status: 422 },
      );
    }

    const { error: claimErr } = await db.from("handle_rename_claims").insert({
      tx_signature: signature,
      wallet: session.wallet,
      old_handle: player.handle,
      new_handle: v.handle,
    });
    if (claimErr) {
      if (claimErr.code === "23505") {
        return NextResponse.json(
          { error: "this payment already renamed your handle" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: claimErr.message }, { status: 500 });
    }
  }

  const { data: clash } = await db
    .from("players")
    .select("wallet")
    .ilike("handle", v.handle)
    .neq("wallet", session.wallet)
    .limit(1);
  if (clash && clash.length > 0) {
    return NextResponse.json({ error: "That handle is taken." }, { status: 409 });
  }

  const { error } = await db
    .from("players")
    .update({ handle: v.handle, last_renamed_at: new Date(now).toISOString() })
    .eq("wallet", session.wallet);
  if (error) {
    return NextResponse.json(
      { error: "db error", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, handle: v.handle });
}
