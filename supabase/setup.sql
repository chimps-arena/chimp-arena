-- ==========================================================================
-- CHIMP Arena - ONE-SHOT database setup
--
-- Paste this whole file into the Supabase SQL editor (Dashboard -> SQL ->
-- New query) and run it once. It is exactly schema.sql + every file in
-- migrations/ concatenated, in order. Everything is idempotent - safe to
-- re-run. (The split files still exist as the canonical incremental record.)
--
-- After this, optionally run seed_demo.sql to populate the leaderboard.
-- ==========================================================================


-- ======================  schema.sql  ======================================

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

-- ---------- Row Level Security ---------------------------------------
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

-- ---------- Realtime -----------------------------------------------
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


-- ================  migrations/0001_atomic_xp.sql  ==========================

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

revoke all on function public.add_player_xp(text, integer) from public, anon, authenticated;


-- ==============  migrations/0002_weekly_scores.sql  =======================

create or replace function public.utc_week_start(ts timestamptz)
returns date
language sql
immutable
as $$
  select (date_trunc('week', ts at time zone 'UTC'))::date;
$$;

create or replace view public.weekly_xp_live as
select
  wallet,
  public.utc_week_start(created_at)      as week_start,
  coalesce(sum(xp_awarded), 0)::integer  as xp_earned,
  count(*)::integer                      as runs
from public.mission_runs
group by wallet, public.utc_week_start(created_at);

create table if not exists public.weekly_scores (
  wallet      text not null references public.players (wallet) on delete cascade,
  week_start  date not null,
  xp_earned   integer not null default 0 check (xp_earned >= 0),
  runs        integer not null default 0,
  frozen_at   timestamptz not null default now(),
  primary key (wallet, week_start)
);

create index if not exists weekly_scores_week_idx
  on public.weekly_scores (week_start);

create or replace function public.freeze_week(p_week_start date)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.weekly_scores (wallet, week_start, xp_earned, runs, frozen_at)
  select wallet, week_start, xp_earned, runs, now()
  from public.weekly_xp_live
  where week_start = p_week_start
  on conflict (wallet, week_start) do update
    set xp_earned = excluded.xp_earned,
        runs      = excluded.runs,
        frozen_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.freeze_week(date) is
  'Snapshot weekly_xp_live for the given Monday-start week into weekly_scores. '
  'Idempotent. Returns the number of rows written.';

alter table public.weekly_scores enable row level security;

drop policy if exists "weekly_scores readable by anyone" on public.weekly_scores;
create policy "weekly_scores readable by anyone"
  on public.weekly_scores for select
  using (true);

revoke all on function public.freeze_week(date) from public, anon, authenticated;
