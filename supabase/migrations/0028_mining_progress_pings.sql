-- ==========================================================================
-- CHIMP Arena - migration 0028: real proof-of-progress for mining depth
-- Run in the Supabase SQL editor AFTER 0027. Safe to re-run.
--
-- Closes a real exploit: /submit only ever checked depth against elapsed
-- wall-clock time since /start (maxDepthFor). A script could buy a permit,
-- call /start, do nothing for ~2 minutes, then /submit the maximum score
-- that much time allows - no actual play required, and since the ceiling is
-- almost purely time-based, it also let a free Pickaxe "wait" its way to the
-- same depth a real player needs an expensive Plasma Cutter to reach,
-- undermining the whole tool-upgrade economy.
--
-- Fix: the client now pings bump_mining_progress every few seconds *during*
-- play with its current depth. Growth per ping is bounded by real wall-clock
-- time elapsed since the *last accepted ping* (not since /start), so no
-- amount of waiting - online or offline - can bank up a big jump to spend on
-- one dishonest ping. /submit (migration 0029) stops trusting the client's
-- reported score for mining entirely and reads this accumulated value
-- instead.
-- ==========================================================================

alter table public.mining_permits
  add column if not exists max_depth_seen int not null default 0,
  add column if not exists last_ping_at   timestamptz;

update public.mining_permits
   set last_ping_at = started_at
 where last_ping_at is null
   and started_at is not null;

create or replace function public.bump_mining_progress(
  p_permit_id uuid,
  p_wallet text,
  p_depth int,
  p_max_rows_per_sec numeric
)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.mining_permits%rowtype;
  v_allowed int;
  v_accepted int;
begin
  select * into v_row
    from public.mining_permits
   where id = p_permit_id
     and wallet = p_wallet
     and started_at is not null
     and submitted_at is null
   for update;

  if not found then
    raise exception 'no_active_permit';
  end if;

  -- +3 is slack for render/network jitter between pings, not a loophole -
  -- it resets every ping, so it can never accumulate into a real exploit.
  v_allowed := v_row.max_depth_seen
    + ceil(greatest(extract(epoch from (now() - coalesce(v_row.last_ping_at, v_row.started_at))), 0) * p_max_rows_per_sec)
    + 3;
  v_accepted := greatest(v_row.max_depth_seen, least(p_depth, v_allowed));

  update public.mining_permits
     set max_depth_seen = v_accepted,
         last_ping_at = now()
   where id = p_permit_id;

  return v_accepted;
end;
$$;

comment on function public.bump_mining_progress(uuid, text, int, numeric) is
  'Proof-of-progress checkpoint for one mining run - depth can only advance '
  'by as much real wall-clock time has passed since the last accepted ping, '
  'so this is the authoritative source of truth settle_mining_run reads at '
  'submit time, never the client''s self-reported final score.';

revoke all on function public.bump_mining_progress(uuid, text, int, numeric)
  from public, anon, authenticated;

-- Resuming a permit (reload mid-run) now also resets last_ping_at to the
-- moment of the resume itself, not the original start - otherwise idle/
-- offline time during the gap would silently convert into a legitimate-
-- looking depth allowance on the very next ping after reopening the tab.
create or replace function public.start_mining_permit(
  p_wallet text,
  p_day date,
  p_daily_cap int,
  p_resume_window_sec int
)
returns table (id uuid, sat bigint, seed bigint, tool_tier smallint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_permit public.mining_permits%rowtype;
  v_started_count int;
begin
  select * into v_permit
    from public.mining_permits
   where wallet = p_wallet
     and started_at is not null
     and submitted_at is null
     and started_at > now() - make_interval(secs => p_resume_window_sec)
   order by started_at desc
   limit 1;

  if found then
    update public.mining_permits
       set last_ping_at = now()
     where id = v_permit.id;
    return query
      select v_permit.id, extract(epoch from v_permit.started_at)::bigint,
             v_permit.seed, v_permit.tool_tier;
    return;
  end if;

  select count(*) into v_started_count
    from public.mining_permits
   where wallet = p_wallet
     and start_day = p_day;

  if v_started_count >= p_daily_cap then
    raise exception 'daily_cap';
  end if;

  select * into v_permit
    from public.mining_permits
   where wallet = p_wallet
     and started_at is null
   order by created_at asc
   limit 1
     for update skip locked;

  if not found then
    raise exception 'no_permit';
  end if;

  update public.mining_permits
     set started_at = now(),
         last_ping_at = now(),
         max_depth_seen = 0,
         start_day = p_day,
         seed = floor(random() * 4294967295)::bigint,
         tool_tier = (select mining_tool from public.players where wallet = p_wallet)
   where id = v_permit.id
  returning * into v_permit;

  return query
    select v_permit.id, extract(epoch from v_permit.started_at)::bigint,
           v_permit.seed, v_permit.tool_tier;
end;
$$;

revoke all on function public.start_mining_permit(text, date, int, int)
  from public, anon, authenticated;
