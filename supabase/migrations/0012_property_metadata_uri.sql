-- ==========================================================================
-- CHIMP Arena - migration 0012: permanent property metadata
-- Run in the Supabase SQL editor AFTER 0011. Safe to re-run.
--
-- Once real art exists, scripts/upload-property-art.mjs uploads each
-- property's image + metadata to Arweave (permanent, no dependency on our
-- own domain staying alive - see the domain-transfer discussion) and writes
-- the resulting URI here. app/api/land/claim falls back to the dynamic
-- /nft/property-metadata/[id] route when this is still null, so minting
-- keeps working before art lands.
-- ==========================================================================

alter table public.properties
  add column if not exists metadata_uri text;
