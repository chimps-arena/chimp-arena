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


-- ============  migrations/0003_weekly_rewards.sql  ========================

create table if not exists public.weekly_pools (
  week_start   date primary key,
  week_index   integer not null,
  pool_amount  bigint  not null,
  total_xp     bigint  not null,
  merkle_root  text,
  distributor  text,
  frozen_at    timestamptz not null default now()
);

create table if not exists public.weekly_allocations (
  wallet       text    not null references public.players (wallet) on delete cascade,
  week_start   date    not null references public.weekly_pools (week_start) on delete cascade,
  xp_earned    integer not null,
  chimp_amount bigint  not null default 0,
  merkle_index integer,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  primary key (wallet, week_start)
);

create index if not exists weekly_allocations_wallet_idx
  on public.weekly_allocations (wallet) where claimed_at is null;
create index if not exists weekly_allocations_week_idx
  on public.weekly_allocations (week_start);

alter table public.weekly_pools       enable row level security;
alter table public.weekly_allocations enable row level security;

drop policy if exists "weekly_pools readable by anyone" on public.weekly_pools;
create policy "weekly_pools readable by anyone"
  on public.weekly_pools for select using (true);

drop policy if exists "weekly_allocations readable by anyone" on public.weekly_allocations;
create policy "weekly_allocations readable by anyone"
  on public.weekly_allocations for select using (true);


-- ================  migrations/0004_streaks.sql  ==========================

alter table public.players
  add column if not exists streak_count    integer not null default 0,
  add column if not exists streak_best     integer not null default 0,
  add column if not exists last_active_day date;

create table if not exists public.daily_bonuses (
  wallet     text not null references public.players (wallet) on delete cascade,
  day        date not null,
  kind       text not null default 'streak',
  xp         integer not null default 0,
  streak_day integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (wallet, day, kind)
);

create index if not exists daily_bonuses_wallet_idx on public.daily_bonuses (wallet);

alter table public.daily_bonuses enable row level security;
drop policy if exists "daily_bonuses readable by anyone" on public.daily_bonuses;
create policy "daily_bonuses readable by anyone"
  on public.daily_bonuses for select using (true);

create or replace function public.bump_streak(p_wallet text, p_today date)
returns table (streak_count integer, advanced boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_last  date;
  v_cur   integer;
  v_best  integer;
begin
  select last_active_day, players.streak_count, players.streak_best
    into v_last, v_cur, v_best
  from public.players
  where wallet = p_wallet
  for update;

  if not found then
    return query select 0, false;
    return;
  end if;

  if v_last is null or v_last < p_today then
    if v_last = p_today - 1 then
      v_cur := v_cur + 1;
    else
      v_cur := 1;
    end if;
    v_best := greatest(v_best, v_cur);
    update public.players
      set streak_count = v_cur,
          streak_best  = v_best,
          last_active_day = p_today
      where wallet = p_wallet;
    return query select v_cur, true;
  else
    return query select v_cur, false;
  end if;
end;
$$;

revoke all on function public.bump_streak(text, date) from public, anon, authenticated;

create or replace view public.weekly_xp_live as
select
  wallet,
  week_start,
  coalesce(sum(xp), 0)::integer     as xp_earned,
  coalesce(sum(is_run), 0)::integer as runs
from (
  select wallet, public.utc_week_start(created_at) as week_start,
         xp_awarded as xp, 1 as is_run
  from public.mission_runs
  union all
  select wallet, public.utc_week_start(created_at) as week_start,
         xp, 0 as is_run
  from public.daily_bonuses
) combined
group by wallet, week_start;
