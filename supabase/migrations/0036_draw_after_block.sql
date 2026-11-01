-- ==========================================================================
-- CHIMP Arena - migration 0036: bonus One of One drawn AFTER each block fills
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- Nobody wins while a block of 1,000 mints is open; when it closes, one
-- mint from the block is drawn (lib/chain/milestone.ts) and its holder gets
-- the bonus. These columns are the public record that lets anyone
-- recompute the draw: the closing mint's transaction, slot and blockhash
-- (the unpredictable half of the seed), the pool size and the winning
-- Astrochimp. chimp_milestones.wallet is the bonus recipient.
-- ==========================================================================

alter table public.chimp_milestones
  add column if not exists winner_asset    text,
  add column if not exists close_signature text,
  add column if not exists close_slot      bigint,
  add column if not exists close_blockhash text,
  add column if not exists pool_size       integer,
  -- the exact pool drawn from (mint numbers, ascending) - a mint still in
  -- flight when the block closed may be recorded later, so the pool can't
  -- be recomputed from nft_mint_claims afterwards
  add column if not exists pool            bigint[];
