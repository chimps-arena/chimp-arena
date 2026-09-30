-- ==========================================================================
-- CHIMP Arena - migration 0019: fix missing RLS on handle_rename_claims
-- Run in the Supabase SQL editor AFTER 0018. Safe to re-run.
--
-- migration 0018 created this table but missed enabling row-level security
-- on it, unlike every other table added this cycle (chimp_variants,
-- chimp_milestones, chimp_style_variants all got it correctly). Caught via
-- Supabase's own "table publicly accessible" alert (2026-10-01) and
-- confirmed live: the public anon key could read every row with no
-- restriction, and without RLS, write/delete are open the same way. All
-- writes to this table happen server-side via the service-role key, which
-- bypasses RLS entirely, so the fix is the same read-only-to-the-public
-- policy every other claims/ledger table already uses.
-- ==========================================================================

alter table public.handle_rename_claims enable row level security;
drop policy if exists "handle_rename_claims readable by anyone" on public.handle_rename_claims;
create policy "handle_rename_claims readable by anyone"
  on public.handle_rename_claims for select using (true);
