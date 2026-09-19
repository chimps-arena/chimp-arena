-- ==========================================================================
-- CHIMP Arena - migration 0009: property resale (secondary market)
-- Run in the Supabase SQL editor AFTER 0008. Safe to re-run.
--
-- An owner lists their property at a price they set; another player buys it
-- in one transaction that splits 97% to the seller / 3% to Astro Corp
-- (ASTROFEE memo). Same off-chain-registry-with-on-chain-receipt pattern as
-- the primary sale - see app/api/market/list and app/api/market/resale/claim.
-- ==========================================================================

alter table public.properties
  add column if not exists resale_price     integer,
  add column if not exists resale_listed_at timestamptz;

do $$
begin
  alter table public.properties
    add constraint properties_resale_price_check
      check (resale_price is null or resale_price > 0);
exception when duplicate_object then null;
end $$;
