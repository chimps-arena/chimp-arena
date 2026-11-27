-- ==========================================================================
-- CHIMP Arena - migration 0043: referral codes + who-brought-in-whom
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- Growth stage 1 (devlog #30). Every player gets a short public code used
-- in their share links (astrochimpz.com/p/<code>). A visitor who arrives
-- through one and then creates a player is recorded here, first touch
-- wins. Nothing is paid out from this yet - it's the history the affiliate
-- program (#21) will build on once its terms are decided.
-- ==========================================================================

alter table public.players add column if not exists ref_code text;

-- Built-ins only (no pgcrypto): 10 hex chars, unique index below catches
-- the astronomically rare clash.
update public.players
  set ref_code = substr(md5(random()::text || clock_timestamp()::text || wallet), 1, 10)
  where ref_code is null;
alter table public.players
  alter column ref_code set default substr(md5(random()::text || clock_timestamp()::text), 1, 10);
alter table public.players alter column ref_code set not null;
create unique index if not exists players_ref_code_idx on public.players (ref_code);

create table if not exists public.referrals (
  referred_wallet  text primary key references public.players (wallet) on delete cascade,
  referrer_wallet  text not null,
  ref_code         text not null check (length(ref_code) <= 32),
  created_at       timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_wallet, created_at);

alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;
