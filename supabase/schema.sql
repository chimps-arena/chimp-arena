-- ==========================================================================
-- CHIMP Arena - database schema
-- Run this once in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
--
-- Crews, mission definitions and the trivia bank live in application code
-- (lib/game/*), not in the database. Only per-player state is stored here.
-- ==========================================================================

-- ---------- players --------------------------------------------------------
create table if not exists public.players (
  wallet      text primary key,
  handle      text not null,
  crew_slug   text,
  xp          integer not null default 0 check (xp >= 0),
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists players_xp_idx on public.players (xp desc);
create index if not exists players_crew_idx on public.players (crew_slug);

-- ---------- mission_runs --------------------------------------------------
create table if not exists public.mission_runs (
  id           bigint generated always as identity primary key,
  wallet       text not null references public.players (wallet) on delete cascade,
  mission_slug text not null,
  day          date not null,
  score        integer not null,
  xp_awarded   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (wallet, mission_slug, day)
);

create index if not exists mission_runs_wallet_day_idx
  on public.mission_runs (wallet, day);
create index if not exists mission_runs_created_idx
  on public.mission_runs (created_at desc);

-- ---------- convenience view: crew standings ---------------------------
create or replace view public.crew_totals as
select
  crew_slug,
  count(*)          as members,
  coalesce(sum(xp), 0) as total_xp
from public.players
where crew_slug is not null
group by crew_slug;

-- ==========================================================================
-- Row Level Security
--   * Reads are public (leaderboards + realtime need anon SELECT).
--   * All writes go through the server using the service-role key, which
--     bypasses RLS. No INSERT/UPDATE/DELETE policies == no client writes.
-- ==========================================================================
alter table public.players     enable row level security;
alter table public.mission_runs enable row level security;

drop policy if exists "players readable by anyone" on public.players;
create policy "players readable by anyone"
  on public.players for select
  using (true);

drop policy if exists "mission_runs readable by anyone" on public.mission_runs;
create policy "mission_runs readable by anyone"
  on public.mission_runs for select
  using (true);

-- ==========================================================================
-- Realtime: broadcast row changes so the leaderboard updates live.
-- ==========================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.players;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.mission_runs;
  exception when duplicate_object then null;
  end;
end $$;
