-- ==========================================================================
-- CHIMP Arena - migration 0034: stage the exact metadata URI of a mint
-- Run in the Supabase SQL editor AFTER 0033. Safe to re-run.
--
-- The buyer's wallet now signs mint transactions FIRST, before the new
-- NFT's own address keypair (Phantom's requirement for transactions it can
-- simulate without a "could be malicious" warning) - so that keypair is
-- generated in the buyer's browser, not on our server. app/api/mint/confirm
-- therefore checks the NFT that actually landed matches what prepare
-- staged, including its metadata URI (which decides the art and tier),
-- stored here.
-- ==========================================================================

alter table public.pending_chimp_mints add column if not exists uri text;
