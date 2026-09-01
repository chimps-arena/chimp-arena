-- ==========================================================================
-- CHIMP Arena - migration 0004: daily streaks
-- Run in the Supabase SQL editor AFTER 0003. Safe to re-run.
--
-- A streak advances on the first mission completed in a UTC day. Missing a
-- day resets it to 0 (hard reset). Streak bonus XP is written to
-- daily_bonuses, which weekly_xp_live now folds in so it counts toward the
-- weekly $CHIMP pool and crew score.
-- ==========================================================================

alter table public.players
  add column if not exists streak_count    integer not null default 0,
  add column if not exists streak_best     integer not null default 0,
  add column if not exists last_active_day date;

-- ---------- daily bonus ledger --------------------------------------
create table if not exists public.daily_bonuses (
  wallet     text not null references public.players (wallet) on delete cascade,
  day        date not null,
  kind       text not null default 'streak',   -- 'streak' | 'milestone'
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

-- ---------- bump_streak: call once on the day's first mission --------
-- Returns the new streak_count and whether this call advanced a new day
-- (true only on the first call per UTC day - the bonus is awarded then).
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
      v_cur := v_cur + 1;          -- consecutive day
    else
      v_cur := 1;                  -- streak broken or first ever
    end if;
    v_best := greatest(v_best, v_cur);
    update public.players
      set streak_count = v_cur,
          streak_best  = v_best,
          last_active_day = p_today
      where wallet = p_wallet;
    return query select v_cur, true;
  else
    return query select v_cur, false;   -- already counted today
  end if;
end;
$$;

revoke all on function public.bump_streak(text, date) from public, anon, authenticated;

-- ---------- weekly_xp_live: fold in daily_bonuses -------------------
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
