-- ==========================================================================
-- CHIMP Arena - migration 0002: weekly score snapshots
-- Run in the Supabase SQL editor AFTER schema.sql. Safe to re-run.
--
-- Feeds the weekly $CHIMP reward pool (see ECONOMY.md section 3).
--   utc_week_start()  - Monday-start UTC week for a timestamp
--   weekly_xp_live    - running totals for any week, computed from mission_runs
--   weekly_scores     - frozen per-week totals; the weekly cron calls freeze_week()
-- ==========================================================================

-- ---------- Monday-start UTC week containing a timestamp ---------------
create or replace function public.utc_week_start(ts timestamptz)
returns date
language sql
immutable
as $$
  select (date_trunc('week', ts at time zone 'UTC'))::date;
$$;

-- ---------- live aggregation (pre-freeze projection) ------------------
-- Used by the P1 UI ("This week: N CHIMP pending") before the week is frozen.
create or replace view public.weekly_xp_live as
select
  wallet,
  public.utc_week_start(created_at)      as week_start,
  coalesce(sum(xp_awarded), 0)::integer  as xp_earned,
  count(*)::integer                      as runs
from public.mission_runs
group by wallet, public.utc_week_start(created_at);

-- ---------- frozen snapshots ----------------------------------------
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

-- ---------- freeze one week into the snapshot table -----------------
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

-- ---------- RLS: snapshots are public-readable (like players) -------
alter table public.weekly_scores enable row level security;

drop policy if exists "weekly_scores readable by anyone" on public.weekly_scores;
create policy "weekly_scores readable by anyone"
  on public.weekly_scores for select
  using (true);

-- Only the service-role key (cron / route handlers) should freeze weeks.
revoke all on function public.freeze_week(date) from public, anon, authenticated;
