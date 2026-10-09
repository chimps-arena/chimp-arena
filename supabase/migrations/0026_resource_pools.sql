-- ==========================================================================
-- CHIMP Arena - migration 0026: pool-based resource market
-- Run in the Supabase SQL editor AFTER 0025. Safe to re-run.
--
-- Replaces the player-to-player listing market (0024) with a shared pool
-- per resource (cobalt/palladium/crystal - Gold stays off the market, same
-- as before). Founder's catch (2026-10-09): the listing market was
-- one-sided - all supply (mining), no real demand, since tool purchases
-- just debited a player's own stash directly. Now:
--   - Mining deposits into the shared pool (supply), same run that credits
--     the player's own balance.
--   - Buying a tool draws from the pool and pays real $CHIMP to Astro
--     Corp, priced dynamically off the pool's current reserve (demand).
-- Price moves with reserve: scarce (low reserve) = expensive, abundant
-- (high reserve) = cheap. This is a simple linear-elasticity curve, not a
-- full constant-product AMM - deliberately, since getting swap math subtly
-- wrong would be a real-money bug; this can be refined later once the
-- simpler model is proven out.
--
-- Astro Corp's wallet is a Ledger requiring manual physical approval for
-- every send, so it can't autonomously pay players back for selling
-- resources - that's why this is buy-side only for now (players always
-- pay in, never need an automatic payout). A real "sell your stash back"
-- feature needs a separate funded hot wallet first (same idea as the mint
-- delegate), not a schema change.
-- ==========================================================================

create table if not exists public.resource_pools (
  resource          text primary key check (resource in ('cobalt', 'palladium', 'crystal')),
  reserve           bigint not null check (reserve >= 0),
  initial_reserve   bigint not null check (initial_reserve > 0),
  base_price_base   bigint not null check (base_price_base > 0),
  updated_at        timestamptz not null default now()
);

alter table public.resource_pools enable row level security;
drop policy if exists "resource_pools readable by anyone" on public.resource_pools;
create policy "resource_pools readable by anyone"
  on public.resource_pools for select using (true);

-- Seed starting reserves/prices (whole-CHIMP base_price shown here before
-- *10^9 for base units - cobalt common/cheap, palladium mid, crystal
-- rare/expensive, same relative ordering the founder's reference prototype
-- used). All placeholder numbers, same as every other economy constant
-- this session - founder to tune before this is real money at scale.
insert into public.resource_pools (resource, reserve, initial_reserve, base_price_base)
values
  ('cobalt',    5000, 5000,  2::bigint * 1000000000),
  ('palladium', 2000, 2000,  5::bigint * 1000000000),
  ('crystal',   500,  500,  15::bigint * 1000000000)
on conflict (resource) do nothing;

create or replace function public.pool_price(p_resource text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (base_price_base * initial_reserve / greatest(reserve, 1))
    from public.resource_pools
   where resource = p_resource;
$$;

comment on function public.pool_price(text) is
  'Spot price per unit, in $CHIMP base units. Linear elasticity: price = '
  'base_price * initial_reserve / reserve, so it rises as the pool depletes '
  'and falls as mining replenishes it.';

revoke all on function public.pool_price(text) from public, anon, authenticated;

create or replace function public.pool_deposit(p_resource text, p_qty bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_qty <= 0 then
    return;
  end if;
  update public.resource_pools
     set reserve = reserve + p_qty,
         updated_at = now()
   where resource = p_resource;
end;
$$;

comment on function public.pool_deposit(text, bigint) is
  'Adds freshly-mined supply to the shared pool - called from settle_mining_run.';

revoke all on function public.pool_deposit(text, bigint) from public, anon, authenticated;

create or replace function public.pool_buy(p_resource text, p_qty bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_price bigint;
  v_cost bigint;
  v_updated int;
begin
  if p_qty <= 0 then
    return 0;
  end if;

  v_price := public.pool_price(p_resource);
  v_cost := v_price * p_qty;

  update public.resource_pools
     set reserve = reserve - p_qty,
         updated_at = now()
   where resource = p_resource
     and reserve >= p_qty;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'pool_depleted';
  end if;

  return v_cost;
end;
$$;

comment on function public.pool_buy(text, bigint) is
  'Quotes and executes a buy against the pool at the CURRENT price (locked '
  'in at call time, not whatever a client displayed earlier), then drains '
  'that much reserve - raising the price for the next buyer. Raises '
  'pool_depleted if the pool somehow doesn''t have that much left.';

revoke all on function public.pool_buy(text, bigint) from public, anon, authenticated;

-- ---------- wire mining's payout into the pool (supply side) -------------

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
    perform public.pool_deposit('cobalt', p_cobalt);
  else
    select public.players.cobalt into v_cobalt from public.players where wallet = p_wallet;
  end if;

  if p_palladium > 0 then
    v_palladium := public.adjust_player_resource(p_wallet, 'palladium', p_palladium, 'mining:' || p_permit_id);
    perform public.pool_deposit('palladium', p_palladium);
  else
    select public.players.palladium into v_palladium from public.players where wallet = p_wallet;
  end if;

  if p_crystal > 0 then
    v_crystal := public.adjust_player_resource(p_wallet, 'crystal', p_crystal, 'mining:' || p_permit_id);
    perform public.pool_deposit('crystal', p_crystal);
  else
    select public.players.crystal into v_crystal from public.players where wallet = p_wallet;
  end if;

  return query select v_gold, v_cobalt, v_palladium, v_crystal;
end;
$$;

revoke all on function public.settle_mining_run(uuid, text, int, int, int, int, int)
  from public, anon, authenticated;

-- ---------- tool purchases now draw from the pool (demand side) ----------

create table if not exists public.tool_purchase_claims_v2 (
  id           uuid primary key default gen_random_uuid(),
  tx_signature text not null unique,
  wallet       text not null references public.players (wallet) on delete cascade,
  tier         smallint not null,
  chimp_paid_base bigint not null,
  created_at   timestamptz not null default now()
);

alter table public.tool_purchase_claims_v2 enable row level security;
drop policy if exists "tool_purchase_claims_v2 readable by anyone" on public.tool_purchase_claims_v2;
create policy "tool_purchase_claims_v2 readable by anyone"
  on public.tool_purchase_claims_v2 for select using (true);

create or replace function public.upgrade_mining_tool_v2(
  p_wallet text,
  p_tier smallint,
  p_signature text,
  p_min_chimp_paid_base bigint,
  p_gold int,
  p_cobalt int,
  p_palladium int,
  p_crystal int
)
returns table (tier smallint, chimp_cost_base bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated int;
  v_total bigint := 0;
begin
  insert into public.tool_purchase_claims_v2 (tx_signature, wallet, tier, chimp_paid_base)
  values (p_signature, p_wallet, p_tier, p_min_chimp_paid_base);

  -- Gold is a direct debit from the player's own stash - it never touches
  -- the pool (Gold stays non-tradeable, see TOKEN-POLICY.md).
  if p_gold > 0 then
    update public.players set gold = public.players.gold - p_gold
     where wallet = p_wallet and public.players.gold >= p_gold;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'insufficient_gold';
    end if;
  end if;

  if p_cobalt > 0 then
    v_total := v_total + public.pool_buy('cobalt', p_cobalt);
  end if;
  if p_palladium > 0 then
    v_total := v_total + public.pool_buy('palladium', p_palladium);
  end if;
  if p_crystal > 0 then
    v_total := v_total + public.pool_buy('crystal', p_crystal);
  end if;

  -- The on-chain payment was verified by the route against a quote fetched
  -- moments earlier - re-check here against the price actually locked in
  -- by pool_buy above, in case it moved between quote and payment.
  if v_total > p_min_chimp_paid_base then
    raise exception 'price_moved';
  end if;

  update public.players
     set mining_tool = p_tier
   where wallet = p_wallet
     and mining_tool = p_tier - 1;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'wrong_tier';
  end if;

  return query select p_tier, v_total;
end;
$$;

comment on function public.upgrade_mining_tool_v2(text, smallint, text, bigint, int, int, int, int) is
  'Replaces upgrade_mining_tool (0023) - cobalt/palladium/crystal costs are '
  'now computed live from the pool (pool_buy) instead of a fixed price, so '
  'buying a tool is what creates real market demand. One transaction: any '
  'failure (duplicate signature, insufficient gold, pool_depleted, '
  'price_moved, wrong_tier) rolls back everything including the claim row.';

revoke all on function public.upgrade_mining_tool_v2(text, smallint, text, bigint, int, int, int, int)
  from public, anon, authenticated;
