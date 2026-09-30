-- ==========================================================================
-- CHIMP Arena - migration 0018: paid handle renames after a free trial
-- Run in the Supabase SQL editor AFTER 0017. Safe to re-run.
--
-- Founder's rule (2026-09-30): renaming is free for the first
-- RENAME_FREE_TRIAL_DAYS after an account is created (see mint-config.ts).
-- After that, a rename costs RENAME_PRICE_CHIMP, verified the same
-- payment-then-act way as every other paid action in this app (see
-- app/api/mint/claim for the pattern). Either way - free or paid - a
-- rename starts a RENAME_COOLDOWN_DAYS lockout before the next one.
-- last_renamed_at (null until the first rename) is what that lockout and
-- the "when can I rename again" UI both read.
-- ==========================================================================

alter table public.players
  add column if not exists last_renamed_at timestamptz;

-- Payment replay guard for paid renames, same shape as nft_mint_claims -
-- one tx_signature can only ever justify one rename.
create table if not exists public.handle_rename_claims (
  id            uuid primary key default gen_random_uuid(),
  tx_signature  text not null unique,
  wallet        text not null,
  old_handle    text not null,
  new_handle    text not null,
  created_at    timestamptz not null default now()
);

create index if not exists handle_rename_claims_wallet_idx on public.handle_rename_claims (wallet);
