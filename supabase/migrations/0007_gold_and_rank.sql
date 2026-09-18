-- ==========================================================================
-- CHIMP Arena - migration 0007: Gold + rank ladder foundation
-- Run in the Supabase SQL editor AFTER 0006. Safe to re-run.
--
-- Gold is off-chain game state (like XP) - never a token, never redeemable
-- to $CHIMP by the protocol (TOKEN-POLICY.md). Earned per mission run,
-- spent later on boosts/structures (not built yet). Rank itself isn't
-- stored - it's computed from xp + owned property count in application code
-- (lib/game/ranks.ts), so the ladder can be retuned without a migration.
-- ==========================================================================

alter table public.players
  add column if not exists gold bigint not null default 0 check (gold >= 0);

create or replace function public.add_player_gold(
  p_wallet text,
  p_amount bigint
)
returns bigint
language sql
volatile
security definer
set search_path = public
as $$
  update public.players
     set gold = gold + greatest(p_amount, 0)
   where wallet = p_wallet
  returning gold;
$$;

comment on function public.add_player_gold(text, bigint) is
  'Atomically add Gold to a player and return the new total. Negative amounts '
  'are clamped to 0. Returns NULL if the wallet has no players row.';

revoke all on function public.add_player_gold(text, bigint) from public, anon, authenticated;
