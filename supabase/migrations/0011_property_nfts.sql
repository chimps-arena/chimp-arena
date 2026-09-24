-- ==========================================================================
-- CHIMP Arena - migration 0011: properties as real NFTs
-- Run in the Supabase SQL editor AFTER 0010. Safe to re-run.
--
-- The property market relaunch: properties become real Metaplex Core NFTs
-- (see lib/chain/property-mint-config.ts, /admin/create-property-collection,
-- /admin/property-collection-authority) instead of pure DB-tracked deeds.
-- owner_wallet stays as a fast cache for listings/search, but the on-chain
-- asset is the source of truth once asset_address is set - same pattern as
-- nft_mint_claims for Astrochimps.
-- ==========================================================================

alter table public.properties
  add column if not exists asset_address     text,
  add column if not exists non_transferable  boolean not null default false;

create unique index if not exists properties_asset_address_idx
  on public.properties (asset_address) where asset_address is not null;

create table if not exists public.property_mint_claims (
  id             uuid primary key default gen_random_uuid(),
  tx_signature   text not null unique,
  wallet         text not null,
  property_id    text not null references public.properties (id),
  asset_address  text not null,
  created_at     timestamptz not null default now()
);

create index if not exists property_mint_claims_wallet_idx on public.property_mint_claims (wallet);

alter table public.property_mint_claims enable row level security;
drop policy if exists "property_mint_claims readable by anyone" on public.property_mint_claims;
create policy "property_mint_claims readable by anyone"
  on public.property_mint_claims for select using (true);
