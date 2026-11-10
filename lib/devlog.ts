/**
 * The founders' /devlog page: written updates (devlog_posts, see migration
 * 0037) plus the list of everything shipped, built from git history by
 * scripts/make-devlog.mjs into lib/devlog.json. Server-only.
 *
 * The page sits behind a PIN set in Vercel as DEVLOG_PIN - never in code,
 * since the repo is public. Unlocking stores a cookie derived from the PIN
 * and JWT_SECRET, so changing the PIN locks everyone out again.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export const DEVLOG_COOKIE = "devlog";

export interface DevlogPost {
  id: number;
  postedAt: string;
  title: string;
  body: string;
}

/** The cookie value that proves the PIN was entered; null if no PIN is set. */
export function devlogToken(): string | null {
  const pin = process.env.DEVLOG_PIN?.trim();
  const secret = process.env.JWT_SECRET;
  if (!pin || !secret) return null;
  return createHash("sha256").update(`devlog:${pin}:${secret}`).digest("hex");
}

export function pinMatches(entered: string): boolean {
  const pin = process.env.DEVLOG_PIN?.trim();
  if (!pin) return false;
  const a = Buffer.from(entered.trim());
  const b = Buffer.from(pin);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function tokenValid(cookie: string | undefined): boolean {
  const want = devlogToken();
  if (!want || !cookie || cookie.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(want));
}

export async function devlogPosts(limit = 20): Promise<DevlogPost[] | null> {
  const { data, error } = await supabaseAdmin()
    .from("devlog_posts")
    .select("id, posted_at, title, body")
    .order("posted_at", { ascending: false })
    .limit(limit);
  if (error) return null;
  return (data ?? []).map((r) => ({
    id: r.id,
    postedAt: r.posted_at,
    title: r.title,
    body: r.body,
  }));
}
