-- ==========================================================================
-- CHIMP Arena - migration 0024: resource marketplace
-- Run in the Supabase SQL editor AFTER 0023. Safe to re-run.
--
-- Cobalt/palladium/crystal only - Gold stays off the market per
-- TOKEN-POLICY.md's "never redeemable to $CHIMP". Listing a resource debits
-- the seller's balance immediately (escrow), which is what makes overselling
-- structurally impossible - no balance, no listing. Buying pays real $CHIMP,
-- verified the same way as every other paid flow in this app (see
-- app/api/market/resale/claim/route.ts), split between seller and the
-- existing marketplace fee rate to Astro Corp.
-- ==========================================================================

create table if not exists public.resource_listings (
  id             uuid primary key default gen_random_uuid(),
  seller_wallet  text not null references public.players (wallet) on delete cascade,
  resource       text not null check (resource in ('cobalt', 'palladium', 'crystal')),
  qty            bigint not null check (qty > 0),
  price_chimp    integer not null check (price_chimp > 0),
  status         text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  reserved_by    text,
  reserved_until timestamptz,
  buyer_wallet   text,
  tx_signature   text unique,
  created_at     timestamptz not null default now(),
  closed_at      timestamptz
);

create index if not exists resource_listings_status_idx
  on public.resource_listings (status, resource, created_at desc);
create index if not exists resource_listings_seller_idx
  on public.resource_listings (seller_wallet, status);

alter table public.resource_listings enable row level security;
drop policy if exists "resource_listings readable by anyone" on public.resource_listings;
create policy "resource_listings readable by anyone"
  on public.resource_listings for select using (true);

create or replace function public.create_resource_listing(
  p_seller text,
  p_resource text,
  p_qty bigint,
  p_price int,
  p_max_active int
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_active_count int;
begin
  if p_resource not in ('cobalt', 'palladium', 'crystal') then
    raise exception 'unknown resource: %', p_resource;
  end if;

  select count(*) into v_active_count
    from public.resource_listings
   where seller_wallet = p_seller
     and status = 'active';

  if v_active_count >= p_max_active then
    raise exception 'too_many_listings';
  end if;

  insert into public.resource_listings (seller_wallet, resource, qty, price_chimp)
  values (p_seller, p_resource, p_qty, p_price)
  returning id into v_id;

  -- Escrow debit - an insufficient balance raises 23514 and rolls back the
  -- insert above too (same transaction), so a listing can never outlive a
  -- failed debit.
  perform public.adjust_player_resource(p_seller, p_resource, -p_qty, 'market:list:' || v_id);

  return v_id;
end;
$$;

comment on function public.create_resource_listing(text, text, bigint, int, int) is
  'Lists a resource for sale and immediately escrows it out of the seller''s '
  'balance. Raises too_many_listings over the cap, or the usual 23514 if the '
  'seller doesn''t actually hold enough of the resource.';

revoke all on function public.create_resource_listing(text, text, bigint, int, int)
  from public, anon, authenticated;

create or replace function public.cancel_resource_listing(
  p_id uuid,
  p_seller text
)
returns bigint
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
     set status = 'cancelled', closed_at = now()
   where id = p_id
     and seller_wallet = p_seller
     and status = 'active'
     and (reserved_until is null or reserved_until < now())
  returning * into v_listing;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'listing_unavailable';
  end if;

  return public.adjust_player_resource(p_seller, v_listing.resource, v_listing.qty, 'market:cancel:' || p_id);
end;
$$;

comment on function public.cancel_resource_listing(uuid, text) is
  'Refunds the seller''s escrowed resource. Blocked while a buyer holds a '
  'live reservation on the listing, closing the "seller cancels mid-payment" race.';

revoke all on function public.cancel_resource_listing(uuid, text)
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
     and seller_wallet <> p_buyer
     and (reserved_by is null or reserved_by = p_buyer or reserved_until < now())
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

comment on function public.reserve_resource_listing(uuid, text, int) is
  'Short-lived hold so two buyers can''t both pay the same listing - the '
  'property resale flow has no equivalent of this and is exposed to that race.';

revoke all on function public.reserve_resource_listing(uuid, text, int)
  from public, anon, authenticated;

create or replace function public.settle_resource_purchase(
  p_id uuid,
  p_buyer text,
  p_signature text,
  p_seller text,
  p_price int
)
returns bigint
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
     set status = 'sold',
         buyer_wallet = p_buyer,
         tx_signature = p_signature,
         closed_at = now()
   where id = p_id
     and status = 'active'
     and seller_wallet = p_seller
     and price_chimp = p_price
     and (reserved_by = p_buyer or reserved_until is null or reserved_until < now())
  returning * into v_listing;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'listing_changed';
  end if;

  return public.adjust_player_resource(p_buyer, v_listing.resource, v_listing.qty, 'market:buy:' || p_id);
end;
$$;

comment on function public.settle_resource_purchase(uuid, text, text, text, int) is
  'Same compound-WHERE guard as the property resale flow - status/seller/'
  'price must all still match. A duplicate tx_signature raises 23505 '
  '(unique constraint); a stale/already-sold listing raises listing_changed.';

revoke all on function public.settle_resource_purchase(uuid, text, text, text, int)
  from public, anon, authenticated;
