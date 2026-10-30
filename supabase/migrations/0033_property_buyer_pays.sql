-- ==========================================================================
-- CHIMP Arena - migration 0033: property buyers pay their own NFT rent
-- Run in the Supabase SQL editor AFTER 0032. Safe to re-run.
--
-- Same move migration 0031 made for Astrochimps, now for the property
-- market: app/api/land/prepare builds ONE buyer-signed transaction holding
-- both the $CHIMP payment and the property NFT's creation (the buyer pays
-- the rent), and app/api/land/confirm then has the mint delegate move it
-- into the Properties collection in its own transaction (network fee
-- only). Previously the delegate paid every property's rent, and when it
-- ran dry two buyers paid and got no property (2026-10-29).
--
-- pending_property_mints is a per-PROPERTY lock, unlike
-- pending_chimp_mints' per-wallet one: a property is one-of-a-kind, so two
-- buyers must never both hold a valid prepared transaction for it, or both
-- could land and pay. A lock is only released once its transaction can no
-- longer land (its blockhash has expired - last_valid_block_height has
-- passed) AND the asset it would have created doesn't exist on-chain.
-- No secret keys are stored here - nothing in this table can mint anything.
-- ==========================================================================

create table if not exists public.pending_property_mints (
  property_id             text primary key references public.properties (id),
  wallet                  text not null,
  asset_address           text not null unique,
  last_valid_block_height bigint not null,
  created_at              timestamptz not null default now()
);

alter table public.pending_property_mints enable row level security;
-- No select policy: internal lock state. Service-role access (the only
-- reader/writer) bypasses RLS.
