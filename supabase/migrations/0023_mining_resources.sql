-- ==========================================================================
-- CHIMP Arena - migration 0023: mining mission, 3 new resources, tools
-- Run in the Supabase SQL editor AFTER 0022. Safe to re-run.
--
-- Phase 1 "Core Loop" (founder plan, 2026-10-07): a real earn source for
-- cobalt/palladium/crystal (off-chain resources, same shape as Gold - see
-- 0007/0008) via a new "Mining" daily mission. Mining runs on a paid permit
-- (real $CHIMP, a genuine sink) rather than being free like the other
-- missions, so XP/Gold-from-XP stay gated once/day (mission_runs' existing
-- unique constraint) but ore payout is per-permit - otherwise a paid permit
-- on an already-completed day would earn nothing.
--
-- Functions use `set search_path = ''` with fully-qualified names throughout
-- (the 0021 hardening convention), not the older `set search_path = public`
-- style from 0007.
-- ==========================================================================

alter table public.players
  add column if not exists cobalt bigint not null default 0 check (cobalt >= 0),
  add column if not exists palladium bigint not null default 0 check (palladium >= 0),
  add column if not exists crystal bigint not null default 0 check (crystal >= 0),
  add column if not exists mining_tool smallint not null default 0 check (mining_tool between 0 and 2);

-- ---------- shared resource ledger (one table, not three) ----------------

create table if not exists public.resource_ledger (
  id         bigint generated always as identity primary key,
  wallet     text not null references public.players (wallet) on delete cascade,
  resource   text not null check (resource in ('cobalt', 'palladium', 'crystal')),
  delta      bigint not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

create index if not exists resource_ledger_wallet_idx
  on public.resource_ledger (wallet, created_at desc);

alter table public.resource_ledger enable row level security;
drop policy if exists "resource_ledger readable by anyone" on public.resource_ledger;
create policy "resource_ledger readable by anyone"
  on public.resource_ledger for select using (true);

create or replace function public.adjust_player_resource(
  p_wallet text,
  p_resource text,
  p_delta bigint,
  p_reason text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_new bigint;
begin
  if p_resource not in ('cobalt', 'palladium', 'crystal') then
    raise exception 'unknown resource: %', p_resource;
  end if;

  update public.players
     set cobalt    = case when p_resource = 'cobalt'    then cobalt    + p_delta else cobalt    end,
         palladium = case when p_resource = 'palladium' then palladium + p_delta else palladium end,
         crystal   = case when p_resource = 'crystal'   then crystal   + p_delta else crystal   end
   where wallet = p_wallet
  returning
    case p_resource
      when 'cobalt' then cobalt
      when 'palladium' then palladium
      else crystal
    end
  into v_new;

  if not found then
    raise exception 'no players row for wallet %', p_wallet;
  end if;

  insert into public.resource_ledger (wallet, resource, delta, reason)
  values (p_wallet, p_resource, p_delta, p_reason);

  return v_new;
end;
$$;

comment on function public.adjust_player_resource(text, text, bigint, text) is
  'Atomically add/subtract a resource (cobalt/palladium/crystal) and log it. '
  'A debit that would go negative raises the column''s CHECK constraint (23514).';

revoke all on function public.adjust_player_resource(text, text, bigint, text)
  from public, anon, authenticated;

-- ---------- mining permits (payment replay-guard + per-run credit) -------

create table if not exists public.mining_permits (
  id              uuid primary key default gen_random_uuid(),
  tx_signature    text not null unique,
  wallet          text not null references public.players (wallet) on delete cascade,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  start_day       date,
  seed            bigint,
  tool_tier       smallint,
  submitted_at    timestamptz,
  depth           integer,
  yield_gold      integer,
  yield_cobalt    integer,
  yield_palladium integer,
  yield_crystal   integer
);

create index if not exists mining_permits_wallet_idx
  on public.mining_permits (wallet, started_at);

alter table public.mining_permits enable row level security;
drop policy if exists "mining_permits readable by anyone" on public.mining_permits;
create policy "mining_permits readable by anyone"
  on public.mining_permits for select using (true);

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
  -- Resume: an already-started, not-yet-submitted permit within the window
  -- (covers a reload mid-run without restarting the clock or losing the fee).
  select * into v_permit
    from public.mining_permits
   where wallet = p_wallet
     and started_at is not null
     and submitted_at is null
     and started_at > now() - make_interval(secs => p_resume_window_sec)
   order by started_at desc
   limit 1;

  if found then
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

comment on function public.start_mining_permit(text, date, int, int) is
  'Resumes an in-progress permit within the resume window, else claims the '
  'oldest unstarted (paid) permit. Raises daily_cap or no_permit as plain '
  'exception messages for the route to map to an HTTP status.';

revoke all on function public.start_mining_permit(text, date, int, int)
  from public, anon, authenticated;

create or replace function public.settle_mining_run(
  p_permit_id uuid,
  p_wallet text,
  p_depth int,
  p_gold int,
  p_cobalt int,
  p_palladium int,
  p_crystal int
)
returns table (gold bigint, cobalt bigint, palladium bigint, crystal bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated int;
  v_gold bigint;
  v_cobalt bigint;
  v_palladium bigint;
  v_crystal bigint;
begin
  update public.mining_permits
     set submitted_at = now(),
         depth = p_depth,
         yield_gold = p_gold,
         yield_cobalt = p_cobalt,
         yield_palladium = p_palladium,
         yield_crystal = p_crystal
   where id = p_permit_id
     and wallet = p_wallet
     and started_at is not null
     and submitted_at is null;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'permit_used';
  end if;

  if p_gold > 0 then
    update public.players set gold = gold + p_gold where wallet = p_wallet returning gold into v_gold;
    insert into public.gold_ledger (wallet, delta, reason) values (p_wallet, p_gold, 'mining:' || p_permit_id);
  else
    select gold into v_gold from public.players where wallet = p_wallet;
  end if;

  if p_cobalt > 0 then
    v_cobalt := public.adjust_player_resource(p_wallet, 'cobalt', p_cobalt, 'mining:' || p_permit_id);
  else
    select cobalt into v_cobalt from public.players where wallet = p_wallet;
  end if;

  if p_palladium > 0 then
    v_palladium := public.adjust_player_resource(p_wallet, 'palladium', p_palladium, 'mining:' || p_permit_id);
  else
    select palladium into v_palladium from public.players where wallet = p_wallet;
  end if;

  if p_crystal > 0 then
    v_crystal := public.adjust_player_resource(p_wallet, 'crystal', p_crystal, 'mining:' || p_permit_id);
  else
    select crystal into v_crystal from public.players where wallet = p_wallet;
  end if;

  return query select v_gold, v_cobalt, v_palladium, v_crystal;
end;
$$;

comment on function public.settle_mining_run(uuid, text, int, int, int, int, int) is
  'Pays out a mining run exactly once (guarded by submitted_at is null) - '
  'raises permit_used on a repeat call for the same permit.';

revoke all on function public.settle_mining_run(uuid, text, int, int, int, int, int)
  from public, anon, authenticated;

-- ---------- tool tiers ----------------------------------------------------

create table if not exists public.tool_purchase_claims (
  id           uuid primary key default gen_random_uuid(),
  tx_signature text not null unique,
  wallet       text not null references public.players (wallet) on delete cascade,
  tier         smallint not null,
  created_at   timestamptz not null default now()
);

alter table public.tool_purchase_claims enable row level security;
drop policy if exists "tool_purchase_claims readable by anyone" on public.tool_purchase_claims;
create policy "tool_purchase_claims readable by anyone"
  on public.tool_purchase_claims for select using (true);

create or replace function public.upgrade_mining_tool(
  p_wallet text,
  p_tier smallint,
  p_signature text,
  p_cobalt int,
  p_palladium int,
  p_crystal int
)
returns smallint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated int;
begin
  insert into public.tool_purchase_claims (tx_signature, wallet, tier)
  values (p_signature, p_wallet, p_tier);

  if p_cobalt > 0 then
    perform public.adjust_player_resource(p_wallet, 'cobalt', -p_cobalt, 'tool:' || p_tier);
  end if;
  if p_palladium > 0 then
    perform public.adjust_player_resource(p_wallet, 'palladium', -p_palladium, 'tool:' || p_tier);
  end if;
  if p_crystal > 0 then
    perform public.adjust_player_resource(p_wallet, 'crystal', -p_crystal, 'tool:' || p_tier);
  end if;

  update public.players
     set mining_tool = p_tier
   where wallet = p_wallet
     and mining_tool = p_tier - 1;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'wrong_tier';
  end if;

  return p_tier;
end;
$$;

comment on function public.upgrade_mining_tool(text, smallint, text, int, int, int) is
  'One transaction: insert the payment claim, debit resource costs, bump the '
  'tier. Any failure (duplicate signature 23505, insufficient resource 23514, '
  'wrong_tier) rolls back everything including the claim row, so the same '
  'payment signature can be retried without double-spending.';

revoke all on function public.upgrade_mining_tool(text, smallint, text, int, int, int)
  from public, anon, authenticated;
