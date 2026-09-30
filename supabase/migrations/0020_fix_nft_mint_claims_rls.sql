-- ==========================================================================
-- CHIMP Arena - migration 0020: fix missing RLS on nft_mint_claims
-- Run in the Supabase SQL editor AFTER 0019. Safe to re-run.
--
-- This is the actual table the Supabase Security Advisor alert was about
-- (confirmed via the Advisor UI directly: "RLS Disabled in Public" on
-- public.nft_mint_claims) - not handle_rename_claims, which was a false
-- lead from an earlier, flawed anon-key read test. nft_mint_claims was
-- created in migration 0010 (2026-09-20) without ever enabling RLS, so
-- it's been open since then. All writes to it happen server-side via the
-- service-role key (app/api/mint/claim), which bypasses RLS entirely, so
-- this fix is read-only-to-the-public, same as every other claims table.
-- ==========================================================================

alter table public.nft_mint_claims enable row level security;
drop policy if exists "nft_mint_claims readable by anyone" on public.nft_mint_claims;
create policy "nft_mint_claims readable by anyone"
  on public.nft_mint_claims for select using (true);
