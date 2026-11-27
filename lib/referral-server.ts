/**
 * Server-only half of lib/referral.ts: record who brought a brand-new
 * player in. Never throws and never blocks sign-in - a lost referral is
 * better than a failed login.
 */
import type { supabaseAdmin } from "@/lib/supabase/server";
import { isRefCode, REF_COOKIE } from "@/lib/referral";

type Db = ReturnType<typeof supabaseAdmin>;

function refCodeFrom(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const hit = cookie
    .split(/;\s*/)
    .find((c) => c.startsWith(`${REF_COOKIE}=`))
    ?.slice(REF_COOKIE.length + 1);
  return isRefCode(hit) ? hit : null;
}

/** Call only right after creating `wallet`'s player row. */
export async function recordReferral(db: Db, req: Request, wallet: string): Promise<void> {
  try {
    const code = refCodeFrom(req);
    if (!code) return;
    const { data: referrer } = await db.from("players").select("wallet").eq("ref_code", code).maybeSingle();
    if (!referrer || referrer.wallet === wallet) return;
    await db
      .from("referrals")
      .upsert(
        { referred_wallet: wallet, referrer_wallet: referrer.wallet, ref_code: code },
        { onConflict: "referred_wallet", ignoreDuplicates: true },
      );
  } catch (e) {
    console.error("recordReferral failed", e);
  }
}
