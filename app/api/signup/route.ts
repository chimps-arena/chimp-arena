import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST { email, website? } -> { ok }
 *
 * Launch-news sign-up from the homepage (devlog #10). Stores the address
 * in launch_signups (migration 0041); nothing is emailed yet.
 *
 * Abuse guards: `website` is a hidden honeypot field real visitors never
 * fill, so bots that do get a silent fake success; and a site-wide brake
 * (same idea as /api/auth/guest) stops a script flooding the table.
 * Per-visitor limits belong in the Vercel firewall.
 *
 * Always answers "ok" for an address already on the list, so the form
 * can't be used to check whether someone signed up.
 */
const BURST_LIMIT = 60;
const BURST_WINDOW_MS = 10 * 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let body: { email?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { count } = await db
    .from("launch_signups")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - BURST_WINDOW_MS).toISOString());
  if ((count ?? 0) >= BURST_LIMIT) {
    return NextResponse.json(
      { error: "Sign-ups are busy right now. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  const { error } = await db
    .from("launch_signups")
    .upsert({ email, source: "home" }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    return NextResponse.json({ error: "Couldn't save that right now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
