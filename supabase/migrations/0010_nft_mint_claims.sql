-- ==========================================================================
-- CHIMP Arena - migration 0010: NFT mint claims (Astrochimps collection)
-- Run in the Supabase SQL editor AFTER 0009. Safe to re-run.
--
-- The buyer sends the $CHIMP payment themselves (unsigned by us); a server
-- endpoint (app/api/mint/claim) verifies that payment on-chain, then uses
-- the collection's mint delegate to create the NFT. This table's unique
-- tx_signature stops one payment from claiming two NFTs.
-- ==========================================================================

create table if not exists public.nft_mint_claims (
  id             uuid primary key default gen_random_uuid(),
  tx_signature   text not null unique,
  wallet         text not null,
  asset_address  text not null,
  created_at     timestamptz not null default now()
);

create index if not exists nft_mint_claims_wallet_idx on public.nft_mint_claims (wallet);
