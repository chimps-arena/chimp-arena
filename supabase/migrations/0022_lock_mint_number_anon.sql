-- ==========================================================================
-- CHIMP Arena - migration 0022: actually lock down next_chimp_mint_number
-- Run in the Supabase SQL editor AFTER 0021. Safe to re-run.
--
-- 0021 revoked execute from `public` and `authenticated`, but Supabase
-- grants the `anon` role its own direct execute privilege on public-schema
-- functions (separate from the generic `public` pseudo-role every role
-- belongs to), so that revoke never touched it. Confirmed live: the anon
-- key could still call this function after 0021 ran, and burned a real
-- mint number doing so (harmless - it just leaves mint number 4 unused,
-- doesn't break the every-1000th-mint milestone check, which triggers on
-- whatever number actually comes back). This closes the actual hole.
-- ==========================================================================

revoke execute on function public.next_chimp_mint_number() from anon;
