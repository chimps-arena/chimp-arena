-- ==========================================================================
-- CHIMP Arena - migration 0044: welcome-back bonus
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- Devlog #28. A player's first visit each UTC day gets a small XP gift and
-- a "welcome back" popup (bigger after a few days away). One row per player
-- per day; the primary key makes the gift impossible to collect twice.
--
-- Kept out of daily_bonuses on purpose: weekly_xp_live sums that table into
-- the weekly $CHIMP pool and crew score, and a gift for just showing up
-- shouldn't pay $CHIMP (or be farmable with throwaway wallets). The XP still
-- counts toward level and rank.
-- ==========================================================================

create table if not exists public.welcome_bonuses (
  wallet     text not null references public.players (wallet) on delete cascade,
  day        date not null,
  xp         integer not null check (xp between 0 and 1000),
  days_away  integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (wallet, day)
);

alter table public.welcome_bonuses enable row level security;
revoke all on public.welcome_bonuses from anon, authenticated;
