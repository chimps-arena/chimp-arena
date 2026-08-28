-- ==========================================================================
-- CHIMP Arena - migration 0001: atomic XP increment
-- Run in the Supabase SQL editor AFTER schema.sql. Safe to re-run.
--
-- Replaces the read-modify-write in app/api/missions/[slug]/submit/route.ts.
-- A single `update ... set xp = xp + amount` is atomic and cannot lose a
-- concurrent write from the same wallet.
-- ==========================================================================

create or replace function public.add_player_xp(
  p_wallet text,
  p_amount integer
)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  update public.players
     set xp        = xp + greatest(p_amount, 0),
         last_seen = now()
   where wallet = p_wallet
  returning xp;
$$;

comment on function public.add_player_xp(text, integer) is
  'Atomically add XP to a player and return the new total. Negative amounts are '
  'clamped to 0. Returns NULL if the wallet has no players row.';

-- Only the service-role key (route handlers) should call this.
revoke all on function public.add_player_xp(text, integer) from public, anon, authenticated;
