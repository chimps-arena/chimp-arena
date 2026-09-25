-- ==========================================================================
-- CHIMP Arena - migration 0013: property image_url
-- Run in the Supabase SQL editor AFTER 0012. Safe to re-run.
--
-- metadata_uri points at the Arweave metadata JSON, which is what goes
-- on-chain - but listing properties in the storefront shouldn't need an
-- extra fetch per property just to find its thumbnail. image_url is the
-- same Arweave image link, stored directly for fast display.
-- ==========================================================================

alter table public.properties
  add column if not exists image_url text;
