-- ==========================================================================
-- CHIMP Arena - migration 0017: reset the mint sequence before real mints
-- Run in the Supabase SQL editor AFTER 0016. One-off, not idempotent -
-- only run this once, before the first real Astrochimp mint.
--
-- Verifying migration 0014's next_chimp_mint_number() RPC from outside the
-- app called it once and burned mint number 1 without an actual mint
-- happening. Nothing's been minted yet, so this is free to reset now -
-- don't run it again once real mints exist, or you'll create duplicate
-- mint_numbers in nft_mint_claims.
-- ==========================================================================

alter sequence public.chimp_mint_seq restart with 1;
