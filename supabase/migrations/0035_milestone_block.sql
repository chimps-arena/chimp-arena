-- ==========================================================================
-- CHIMP Arena - migration 0035: one bonus One of One per block of mints
-- Run in the Supabase SQL editor BEFORE deploying the random draw. Safe to re-run.
--
-- The bonus no longer lands on every 1000th mint (timeable by anyone
-- counting mints on-chain); each block of 1000 mints has a secret winning
-- number instead - see lib/chain/milestone.ts. The bonus goes to the first
-- confirmed mint at or after it, so `block` must be unique: two mints past
-- the winner confirming at the same moment can't both get one.
-- ==========================================================================

alter table public.chimp_milestones add column if not exists block bigint;

update public.chimp_milestones
  set block = (mint_number - 1) / 1000
  where block is null;

create unique index if not exists chimp_milestones_block_key
  on public.chimp_milestones (block);
