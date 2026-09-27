-- ==========================================================================
-- CHIMP Arena - migration 0014: Astrochimp one-of-ones + mint numbering
-- Run in the Supabase SQL editor AFTER 0013. Safe to re-run.
--
-- Standard and Rare Astrochimps mint indefinitely (no fixed catalog row per
-- mint - there's nothing scarce to claim, so /api/mint/claim just tags them
-- with the drawn tier and moves on). One-of-ones are genuinely scarce
-- though, so they keep a real catalog: each row is claimed exactly once,
-- same race-safe pattern as properties (asset_address unique nullable).
--
-- chimp_mint_seq gives every successful mint a reliable sequential number
-- (Postgres sequences are atomic under concurrency, unlike a plain SELECT
-- count(*) which two simultaneous mints could both read as "999"). The
-- founder's rule - every 1000th mint also gets a bonus one-of-one - reads
-- this number; chimp_milestones is the record of when that actually fired.
-- ==========================================================================

create table if not exists public.chimp_variants (
  id             text primary key,
  tier           text not null default 'one_of_one' check (tier = 'one_of_one'),
  name           text not null,
  blurb          text,
  image_url      text,
  metadata_uri   text,
  asset_address  text,
  wallet         text,
  claimed_at     timestamptz
);

create unique index if not exists chimp_variants_asset_address_idx
  on public.chimp_variants (asset_address) where asset_address is not null;

create index if not exists chimp_variants_unclaimed_idx
  on public.chimp_variants (tier) where asset_address is null;

create sequence if not exists public.chimp_mint_seq;

create or replace function public.next_chimp_mint_number()
returns bigint
language sql
security definer
as $$ select nextval('public.chimp_mint_seq') $$;

create table if not exists public.chimp_milestones (
  mint_number    bigint primary key,
  wallet         text not null,
  variant_id     text references public.chimp_variants (id),
  asset_address  text,
  awarded_at     timestamptz not null default now()
);

alter table public.nft_mint_claims
  add column if not exists chimp_variant_id text references public.chimp_variants (id),
  add column if not exists tier             text,
  add column if not exists mint_number      bigint;

alter table public.chimp_variants enable row level security;
drop policy if exists "chimp_variants readable by anyone" on public.chimp_variants;
create policy "chimp_variants readable by anyone"
  on public.chimp_variants for select using (true);

alter table public.chimp_milestones enable row level security;
drop policy if exists "chimp_milestones readable by anyone" on public.chimp_milestones;
create policy "chimp_milestones readable by anyone"
  on public.chimp_milestones for select using (true);
