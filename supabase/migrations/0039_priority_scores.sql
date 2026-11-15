-- ==========================================================================
-- CHIMP Arena - migration 0039: Priority User Score
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- Each wallet's latest Priority User Score (lib/priority-score.ts), worked
-- out from what's on-chain - $CHIMP held and for how long, Astrochimps and
-- properties owned, wallet age - and stored so the site can read it
-- instantly (e.g. to favour real holders under load). Recomputed when it's
-- over a day old or the player asks for a recheck. Server-only.
-- ==========================================================================

create table if not exists public.priority_scores (
  wallet      text primary key references public.players(wallet) on delete cascade,
  score       integer not null check (score >= 0),
  tier        text not null check (tier in ('none', 'bronze', 'silver', 'gold', 'platinum')),
  -- per-signal points and the raw facts behind them, for the Safu Bank panel
  breakdown   jsonb not null,
  checked_at  timestamptz not null default now()
);

create index if not exists priority_scores_score_idx on public.priority_scores (score desc);

alter table public.priority_scores enable row level security;
revoke all on public.priority_scores from anon, authenticated;
