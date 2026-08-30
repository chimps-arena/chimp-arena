-- ==========================================================================
-- CHIMP Arena - migration 0003: weekly reward allocations
-- Run in the Supabase SQL editor AFTER 0002. Safe to re-run.
--
-- The off-chain half of the weekly $CHIMP claim (ECONOMY.md §3, roadmap #34):
--   weekly_pools        - one row per frozen week: pool size, total XP, and
--                         (once built) the Merkle root + on-chain distributor
--   weekly_allocations  - per-wallet $CHIMP owed for a week, with the leaf
--                         index and claim status
-- Amounts are in base units (6 decimals), stored as bigint.
-- ==========================================================================

create table if not exists public.weekly_pools (
  week_start   date primary key,
  week_index   integer not null,          -- 1-based Season 1 week
  pool_amount  bigint  not null,          -- base units
  total_xp     bigint  not null,
  merkle_root  text,                      -- set when the tree is built
  distributor  text,                      -- on-chain distributor account
  frozen_at    timestamptz not null default now()
);

create table if not exists public.weekly_allocations (
  wallet       text    not null references public.players (wallet) on delete cascade,
  week_start   date    not null references public.weekly_pools (week_start) on delete cascade,
  xp_earned    integer not null,
  chimp_amount bigint  not null default 0,  -- base units, after the per-wallet cap
  merkle_index integer,                     -- leaf position, assigned at freeze
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  primary key (wallet, week_start)
);

create index if not exists weekly_allocations_wallet_idx
  on public.weekly_allocations (wallet) where claimed_at is null;
create index if not exists weekly_allocations_week_idx
  on public.weekly_allocations (week_start);

-- Public-readable like players / weekly_scores. All writes are service-role.
alter table public.weekly_pools       enable row level security;
alter table public.weekly_allocations enable row level security;

drop policy if exists "weekly_pools readable by anyone" on public.weekly_pools;
create policy "weekly_pools readable by anyone"
  on public.weekly_pools for select using (true);

drop policy if exists "weekly_allocations readable by anyone" on public.weekly_allocations;
create policy "weekly_allocations readable by anyone"
  on public.weekly_allocations for select using (true);
