-- ==========================================================================
-- CHIMP Arena - migration 0031: buyer pays their own mint rent
-- Run in the Supabase SQL editor AFTER 0030. Safe to re-run.
--
-- Until now the mint delegate wallet paid the real SOL rent to create every
-- Astrochimp NFT (~0.003 SOL each, confirmed from a real past mint) - a real
-- ongoing cost with no $CHIMP-side lever to recover it at current market
-- price (investigated 2026-10-26). This moves that cost onto the buyer:
-- app/api/mint/prepare builds ONE transaction containing both the $CHIMP
-- payment and the NFT creation, with the buyer's own wallet as fee payer
-- for the whole thing (a noop signer stands in for them server-side - see
-- that route's comments). The delegate only co-signs to authorize joining
-- the collection; it no longer pays anything.
--
-- pending_chimp_mints is short-lived staging, not a real record of anything -
-- it holds exactly what app/api/mint/prepare baked into the unsigned
-- transaction (no secret key - nothing here can mint anything on its own),
-- so app/api/mint/confirm can look up what SHOULD have landed without
-- trusting anything the client says about it, only the on-chain transaction
-- it independently re-verifies. It also stops a double-click from burning
-- two mint numbers while the first prepared transaction still waits on the
-- buyer's wallet popup. The real, permanent record is still nft_mint_claims
-- (unchanged), written at confirm time once the combined transaction has
-- actually landed on-chain - exactly the same role tx_signature's unique
-- constraint already played before this change, just now covering the
-- combined transaction instead of a separate payment-only one.
-- ==========================================================================

create table if not exists public.pending_chimp_mints (
  wallet         text primary key,
  asset_address  text not null,
  tier           text not null,
  mint_number    bigint not null,
  name           text not null,
  image_url      text not null,
  created_at     timestamptz not null default now()
);

alter table public.pending_chimp_mints enable row level security;
-- No select policy: this is internal lock state, not something the public
-- ever needs to read (unlike nft_mint_claims, which is a real audit trail).
-- Service-role access (the only writer/reader) bypasses RLS entirely.
