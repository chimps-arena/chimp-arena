-- ==========================================================================
-- CHIMP Arena - migration 0025: fix ambiguous column refs in 0023/0024
-- Run in the Supabase SQL editor AFTER 0024. Safe to re-run.
--
-- Three functions declared RETURNS TABLE columns with the same names as
-- real columns on the tables they touch (e.g. start_mining_permit returns
-- a column called `id`, and also updates mining_permits, which has its own
-- `id` column). PL/pgSQL implicitly turns RETURNS TABLE columns into
-- variables visible everywhere in the function body, so any bare
-- reference to that name inside a WHERE/SET/SELECT becomes genuinely
-- ambiguous to Postgres - confirmed live (2026-10-08): the very first real
-- permit purchase hit "column reference \"id\" is ambiguous" from
-- start_mining_permit. Found and fixed the same class of bug in
-- settle_mining_run (gold/cobalt/palladium/crystal collide with
-- players' own columns) and reserve_resource_listing (seller_wallet/
-- reserved_until collide with resource_listings' own columns) before they
-- had a chance to hit the same error.
--
-- Fix is to qualify every affected bare reference with its table name -
-- SET-clause targets are left alone (Postgres doesn't allow qualifying
-- those, and they're unambiguous by grammar regardless).
-- ==========================================================================

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
   where public.mining_permits.id = v_permit.id
  returning * into v_permit;

  return query
    select v_permit.id, extract(epoch from v_permit.started_at)::bigint,
           v_permit.seed, v_permit.tool_tier;
end;
$$;

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
    update public.players set gold = public.players.gold + p_gold where wallet = p_wallet
      returning public.players.gold into v_gold;
    insert into public.gold_ledger (wallet, delta, reason) values (p_wallet, p_gold, 'mining:' || p_permit_id);
  else
    select public.players.gold into v_gold from public.players where wallet = p_wallet;
  end if;

  if p_cobalt > 0 then
    v_cobalt := public.adjust_player_resource(p_wallet, 'cobalt', p_cobalt, 'mining:' || p_permit_id);
  else
    select public.players.cobalt into v_cobalt from public.players where wallet = p_wallet;
  end if;

  if p_palladium > 0 then
    v_palladium := public.adjust_player_resource(p_wallet, 'palladium', p_palladium, 'mining:' || p_permit_id);
  else
    select public.players.palladium into v_palladium from public.players where wallet = p_wallet;
  end if;

  if p_crystal > 0 then
    v_crystal := public.adjust_player_resource(p_wallet, 'crystal', p_crystal, 'mining:' || p_permit_id);
  else
    select public.players.crystal into v_crystal from public.players where wallet = p_wallet;
  end if;

  return query select v_gold, v_cobalt, v_palladium, v_crystal;
end;
$$;

revoke all on function public.settle_mining_run(uuid, text, int, int, int, int, int)
  from public, anon, authenticated;

create or replace function public.reserve_resource_listing(
  p_id uuid,
  p_buyer text,
  p_seconds int
)
returns table (seller_wallet text, resource text, qty bigint, price_chimp int, reserved_until timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.resource_listings%rowtype;
  v_updated int;
begin
  update public.resource_listings
     set reserved_by = p_buyer,
         reserved_until = now() + make_interval(secs => p_seconds)
   where id = p_id
     and status = 'active'
     and public.resource_listings.seller_wallet <> p_buyer
     and (reserved_by is null or reserved_by = p_buyer or public.resource_listings.reserved_until < now())
  returning * into v_listing;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'listing_unavailable';
  end if;

  return query
    select v_listing.seller_wallet, v_listing.resource, v_listing.qty,
           v_listing.price_chimp, v_listing.reserved_until;
end;
$$;

revoke all on function public.reserve_resource_listing(uuid, text, int)
  from public, anon, authenticated;
