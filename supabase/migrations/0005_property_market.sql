-- ==========================================================================
-- CHIMP Arena - migration 0005: property market (primary sale, v1)
-- Run in the Supabase SQL editor AFTER 0004. Safe to re-run.
--
-- Off-chain ownership registry with an on-chain receipt: buying a listed
-- property transfers $CHIMP to Astro Corp on mainnet (with an ASTRODEED
-- memo), and the server verifies that transfer before flipping owner_wallet
-- here. The chain doesn't enforce "not already sold" - this table does, via
-- the `owner_wallet is null` guard in the claim route. `tx_signature` is
-- UNIQUE so one payment can never claim two properties.
-- ==========================================================================

create table if not exists public.properties (
  id            text primary key,          -- e.g. 'belt-founders-stall-1'
  name          text not null,
  zone          text not null,             -- 'The Belt' | 'Astroworld Core' | 'Helios Docks' | 'Lunar Rim'
  type          text not null,             -- 'mining_claim' | 'hangar' | 'vault' | 'greenhouse' | 'dock'
  price_chimp   integer not null check (price_chimp > 0),
  owner_wallet  text references public.players (wallet) on delete set null,
  tx_signature  text unique,
  acquired_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists properties_zone_idx on public.properties (zone);
create index if not exists properties_owner_idx on public.properties (owner_wallet);

alter table public.properties enable row level security;
drop policy if exists "properties readable by anyone" on public.properties;
create policy "properties readable by anyone"
  on public.properties for select using (true);
-- No insert/update/delete policy: all writes go through the service-role key.

-- ---------- seed listings (idempotent) --------------------------------
insert into public.properties (id, name, zone, type, price_chimp) values
  ('belt-founders-stall-1',  'Founders Stall 1',   'The Belt',        'mining_claim', 70),
  ('belt-founders-stall-2',  'Founders Stall 2',   'The Belt',        'mining_claim', 85),
  ('belt-scrapyard-hangar',  'Scrapyard Hangar',   'The Belt',        'hangar',       150),
  ('belt-drydock',           'Drydock',            'The Belt',        'dock',         120),
  ('core-foundry-a',         'Foundry A',          'Astroworld Core', 'vault',        260),
  ('core-foundry-b',         'Foundry B',          'Astroworld Core', 'vault',        340),
  ('core-atrium-greenhouse', 'Atrium Greenhouse',  'Astroworld Core', 'greenhouse',   190),
  ('core-plaza-hangar',      'Plaza Hangar',       'Astroworld Core', 'hangar',       210),
  ('helios-tanker-dock',     'Tanker Dock',        'Helios Docks',    'dock',         175),
  ('helios-refinery-claim',  'Refinery Claim',     'Helios Docks',    'mining_claim', 130),
  ('helios-vault-7',         'Vault 7',            'Helios Docks',    'vault',        240),
  ('helios-greenhouse-dome', 'Greenhouse Dome',    'Helios Docks',    'greenhouse',   200),
  ('lunar-rim-claim-1',      'Rim Claim 1',        'Lunar Rim',       'mining_claim', 95),
  ('lunar-rim-claim-2',      'Rim Claim 2',        'Lunar Rim',       'mining_claim', 110),
  ('lunar-outpost-hangar',   'Outpost Hangar',     'Lunar Rim',       'hangar',       165),
  ('lunar-far-dock',         'Far Dock',           'Lunar Rim',       'dock',         140)
on conflict (id) do nothing;
