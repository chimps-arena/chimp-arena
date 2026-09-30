-- ==========================================================================
-- CHIMP Arena - migration 0021: clear the remaining Security Advisor items
-- Run in the Supabase SQL editor AFTER 0020. Safe to re-run.
--
-- Everything else the Advisor flagged alongside the nft_mint_claims RLS gap
-- (see 0020):
--
-- 1. next_chimp_mint_number() is `security definer` (needed - it hands out
--    sequence numbers without exposing the raw sequence) but was callable
--    by anyone, anon or signed-in. That's the exact hole that let one
--    out-of-band test call burn mint number 1 during development (see
--    0017's comment) - if it's public, anyone can burn real mint numbers
--    the same way, for real, at any time. Only the server (service role,
--    via app/api/mint/claim) ever needs to call it.
-- 2. Both this function and utc_week_start() had no fixed search_path,
--    which Postgres flags because a caller's session search_path could in
--    theory redirect an unqualified name inside the function to a
--    different object. Both already fully-qualify everything they touch,
--    so pinning search_path to empty is a no-op behaviorally and just
--    removes the theoretical hijack surface.
-- 3. crew_totals and weekly_xp_live are `security definer` views (the
--    Postgres default), meaning they'd run with the view owner's
--    privileges no matter who queries them. Both only aggregate tables
--    that already have public-read RLS policies (players, mission_runs,
--    daily_bonuses), so switching them to security_invoker changes
--    nothing about who can see what - it just makes that explicit instead
--    of incidental.
-- ==========================================================================

revoke execute on function public.next_chimp_mint_number() from public;
revoke execute on function public.next_chimp_mint_number() from authenticated;
grant execute on function public.next_chimp_mint_number() to service_role;

alter function public.next_chimp_mint_number() set search_path = '';
alter function public.utc_week_start(timestamptz) set search_path = '';

alter view public.crew_totals set (security_invoker = true);
alter view public.weekly_xp_live set (security_invoker = true);
