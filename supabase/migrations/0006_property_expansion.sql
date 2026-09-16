-- ==========================================================================
-- CHIMP Arena - migration 0006: property market expansion
-- Run in the Supabase SQL editor AFTER 0005. Safe to re-run.
--
-- Adds `blurb` (one-line flavour text) and `status` (distinguishes a listing
-- from Astro-Corp inventory that isn't for sale yet - separate from
-- `owner_wallet`, which only ever means "a player bought this"). Then seeds
-- 20 named listings across the 4 zones with a much richer type roster.
-- ==========================================================================

alter table public.properties
  add column if not exists blurb  text,
  add column if not exists status text not null default 'listed'
    check (status in ('listed', 'held'));

insert into public.properties (id, name, zone, type, price_chimp, blurb, status) values
  ('belt-a12',  'Nickel Claim A12', 'The Belt',        'mining_claim', 140, 'Nickel-iron asteroid with a live beacon',                    'listed'),
  ('belt-k09',  'Outpost K09',      'The Belt',        'outpost',      125, 'Armored module and a sensor mast',                           'listed'),
  ('belt-c03',  'Ice Claim C03',    'The Belt',        'mining_claim', 175, 'Frozen nickel ice with a live drill spine',                  'listed'),
  ('belt-ck1',  'Comms Tower CK1',  'The Belt',        'tower',        135, 'Cyan dishes and orange strobes on a needle tower',           'listed'),
  ('belt-fb',   'The Foundry',      'The Belt',        'foundry',      340, 'Molten orange metal and industrial pipe on a dark rock',     'listed'),
  ('hel-h04',   'Bay H04',          'Helios Docks',    'hangar',       280, 'Open bay with a shuttle pad',                                'listed'),
  ('hel-f07',   'Fuel Lot F07',     'Helios Docks',    'fuel_lot',     190, 'Cryogenic tanks and a service gantry',                       'listed'),
  ('hel-yb',    'Cargo Yard',       'Helios Docks',    'yard',         150, 'Stacked containers, a gantry, and an open platform',         'listed'),
  ('hel-s02',   'Array Farm S02',   'Helios Docks',    'array',        165, 'Orange-and-cyan array farm bolted to the Helios truss',      'listed'),
  ('hel-d06',   'Gantry Dock D06',  'Helios Docks',    'dock',         300, 'Open gantry dock',                                           'listed'),
  ('core-ar3',  'Armory AR3',       'Astroworld Core', 'armory',       160, 'Sealed crates, mesh cages, and a locker run',                'listed'),
  ('core-am12', 'The Box',          'Astroworld Core', 'box',          95,  'Stepped seating carved into the hull',                       'listed'),
  ('core-l09',  'Loft L09',         'Astroworld Core', 'loft',         210, 'Tall windows over stacked modules',                          'listed'),
  ('core-fs1',  'Founders Stall',  'Astroworld Core', 'stall',        70,  'Brushed-metal kiosk on the Founders concourse',              'listed'),
  ('core-nc4',  'Neon Cantina',     'Astroworld Core', 'cantina',      230, 'A lit stall on the plaza',                                   'listed'),
  ('core-vx1',  'The Vault',        'Astroworld Core', 'vault',        300, 'Circular steel door and a lockbox chamber',                  'held'),
  ('lun-f18',   'Survey Field F18', 'Lunar Rim',       'field',        85,  'Survey stake in pale regolith',                              'listed'),
  ('lun-m07',   'Crater Field M07', 'Lunar Rim',       'field',        90,  'A dug crater of pale rock with a survey mast',               'listed'),
  ('lun-gd2',   'Grow Dome GD2',    'Lunar Rim',       'dome',         180, 'Pressurized greenhouse with orange grow light',              'listed'),
  ('lun-obs',   'Rim Observatory',  'Lunar Rim',       'observatory',  220, 'Dome on a crater rim, shutter half open',                    'held')
on conflict (id) do nothing;
