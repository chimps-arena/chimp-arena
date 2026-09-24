-- ==========================================================================
-- CHIMP Arena - ONE-SHOT database setup
--
-- Paste this whole file into the Supabase SQL editor (Dashboard -> SQL ->
-- New query) and run it once. It is exactly schema.sql + every file in
-- migrations/ concatenated, in order. Everything is idempotent - safe to
-- re-run. (The split files still exist as the canonical incremental record.)
--
-- After this, optionally run seed_demo.sql to populate the leaderboard.
-- ==========================================================================


-- ======================  schema.sql  ======================================

-- ---------- players --------------------------------------------------------
create table if not exists public.players (
  wallet      text primary key,
  handle      text not null,
  crew_slug   text,
  xp          integer not null default 0 check (xp >= 0),
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists players_xp_idx on public.players (xp desc);
create index if not exists players_crew_idx on public.players (crew_slug);

-- ---------- mission_runs --------------------------------------------------
create table if not exists public.mission_runs (
  id           bigint generated always as identity primary key,
  wallet       text not null references public.players (wallet) on delete cascade,
  mission_slug text not null,
  day          date not null,
  score        integer not null,
  xp_awarded   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (wallet, mission_slug, day)
);

create index if not exists mission_runs_wallet_day_idx
  on public.mission_runs (wallet, day);
create index if not exists mission_runs_created_idx
  on public.mission_runs (created_at desc);

-- ---------- convenience view: crew standings ---------------------------
create or replace view public.crew_totals as
select
  crew_slug,
  count(*)          as members,
  coalesce(sum(xp), 0) as total_xp
from public.players
where crew_slug is not null
group by crew_slug;

-- ---------- Row Level Security ---------------------------------------
alter table public.players     enable row level security;
alter table public.mission_runs enable row level security;

drop policy if exists "players readable by anyone" on public.players;
create policy "players readable by anyone"
  on public.players for select
  using (true);

drop policy if exists "mission_runs readable by anyone" on public.mission_runs;
create policy "mission_runs readable by anyone"
  on public.mission_runs for select
  using (true);

-- ---------- Realtime -----------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.players;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.mission_runs;
  exception when duplicate_object then null;
  end;
end $$;


-- ================  migrations/0001_atomic_xp.sql  ==========================

create or replace function public.add_player_xp(
  p_wallet text,
  p_amount integer
)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  update public.players
     set xp        = xp + greatest(p_amount, 0),
         last_seen = now()
   where wallet = p_wallet
  returning xp;
$$;

comment on function public.add_player_xp(text, integer) is
  'Atomically add XP to a player and return the new total. Negative amounts are '
  'clamped to 0. Returns NULL if the wallet has no players row.';

revoke all on function public.add_player_xp(text, integer) from public, anon, authenticated;


-- ==============  migrations/0002_weekly_scores.sql  =======================

create or replace function public.utc_week_start(ts timestamptz)
returns date
language sql
immutable
as $$
  select (date_trunc('week', ts at time zone 'UTC'))::date;
$$;

create or replace view public.weekly_xp_live as
select
  wallet,
  public.utc_week_start(created_at)      as week_start,
  coalesce(sum(xp_awarded), 0)::integer  as xp_earned,
  count(*)::integer                      as runs
from public.mission_runs
group by wallet, public.utc_week_start(created_at);

create table if not exists public.weekly_scores (
  wallet      text not null references public.players (wallet) on delete cascade,
  week_start  date not null,
  xp_earned   integer not null default 0 check (xp_earned >= 0),
  runs        integer not null default 0,
  frozen_at   timestamptz not null default now(),
  primary key (wallet, week_start)
);

create index if not exists weekly_scores_week_idx
  on public.weekly_scores (week_start);

create or replace function public.freeze_week(p_week_start date)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.weekly_scores (wallet, week_start, xp_earned, runs, frozen_at)
  select wallet, week_start, xp_earned, runs, now()
  from public.weekly_xp_live
  where week_start = p_week_start
  on conflict (wallet, week_start) do update
    set xp_earned = excluded.xp_earned,
        runs      = excluded.runs,
        frozen_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.freeze_week(date) is
  'Snapshot weekly_xp_live for the given Monday-start week into weekly_scores. '
  'Idempotent. Returns the number of rows written.';

alter table public.weekly_scores enable row level security;

drop policy if exists "weekly_scores readable by anyone" on public.weekly_scores;
create policy "weekly_scores readable by anyone"
  on public.weekly_scores for select
  using (true);

revoke all on function public.freeze_week(date) from public, anon, authenticated;


-- ============  migrations/0003_weekly_rewards.sql  ========================

create table if not exists public.weekly_pools (
  week_start   date primary key,
  week_index   integer not null,
  pool_amount  bigint  not null,
  total_xp     bigint  not null,
  merkle_root  text,
  distributor  text,
  frozen_at    timestamptz not null default now()
);

create table if not exists public.weekly_allocations (
  wallet       text    not null references public.players (wallet) on delete cascade,
  week_start   date    not null references public.weekly_pools (week_start) on delete cascade,
  xp_earned    integer not null,
  chimp_amount bigint  not null default 0,
  merkle_index integer,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  primary key (wallet, week_start)
);

create index if not exists weekly_allocations_wallet_idx
  on public.weekly_allocations (wallet) where claimed_at is null;
create index if not exists weekly_allocations_week_idx
  on public.weekly_allocations (week_start);

alter table public.weekly_pools       enable row level security;
alter table public.weekly_allocations enable row level security;

drop policy if exists "weekly_pools readable by anyone" on public.weekly_pools;
create policy "weekly_pools readable by anyone"
  on public.weekly_pools for select using (true);

drop policy if exists "weekly_allocations readable by anyone" on public.weekly_allocations;
create policy "weekly_allocations readable by anyone"
  on public.weekly_allocations for select using (true);


-- ================  migrations/0004_streaks.sql  ==========================

alter table public.players
  add column if not exists streak_count    integer not null default 0,
  add column if not exists streak_best     integer not null default 0,
  add column if not exists last_active_day date;

create table if not exists public.daily_bonuses (
  wallet     text not null references public.players (wallet) on delete cascade,
  day        date not null,
  kind       text not null default 'streak',
  xp         integer not null default 0,
  streak_day integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (wallet, day, kind)
);

create index if not exists daily_bonuses_wallet_idx on public.daily_bonuses (wallet);

alter table public.daily_bonuses enable row level security;
drop policy if exists "daily_bonuses readable by anyone" on public.daily_bonuses;
create policy "daily_bonuses readable by anyone"
  on public.daily_bonuses for select using (true);

create or replace function public.bump_streak(p_wallet text, p_today date)
returns table (streak_count integer, advanced boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_last  date;
  v_cur   integer;
  v_best  integer;
begin
  select last_active_day, players.streak_count, players.streak_best
    into v_last, v_cur, v_best
  from public.players
  where wallet = p_wallet
  for update;

  if not found then
    return query select 0, false;
    return;
  end if;

  if v_last is null or v_last < p_today then
    if v_last = p_today - 1 then
      v_cur := v_cur + 1;
    else
      v_cur := 1;
    end if;
    v_best := greatest(v_best, v_cur);
    update public.players
      set streak_count = v_cur,
          streak_best  = v_best,
          last_active_day = p_today
      where wallet = p_wallet;
    return query select v_cur, true;
  else
    return query select v_cur, false;
  end if;
end;
$$;

revoke all on function public.bump_streak(text, date) from public, anon, authenticated;

create or replace view public.weekly_xp_live as
select
  wallet,
  week_start,
  coalesce(sum(xp), 0)::integer     as xp_earned,
  coalesce(sum(is_run), 0)::integer as runs
from (
  select wallet, public.utc_week_start(created_at) as week_start,
         xp_awarded as xp, 1 as is_run
  from public.mission_runs
  union all
  select wallet, public.utc_week_start(created_at) as week_start,
         xp, 0 as is_run
  from public.daily_bonuses
) combined
group by wallet, week_start;


-- ============  migrations/0005_property_market.sql  =======================

create table if not exists public.properties (
  id            text primary key,
  name          text not null,
  zone          text not null,
  type          text not null,
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


-- ============  migrations/0006_property_expansion.sql  ====================

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


-- ============  migrations/0007_gold_and_rank.sql  ==========================

alter table public.players
  add column if not exists gold bigint not null default 0 check (gold >= 0);

create or replace function public.add_player_gold(
  p_wallet text,
  p_amount bigint
)
returns bigint
language sql
volatile
security definer
set search_path = public
as $$
  update public.players
     set gold = gold + greatest(p_amount, 0)
   where wallet = p_wallet
  returning gold;
$$;

comment on function public.add_player_gold(text, bigint) is
  'Atomically add Gold to a player and return the new total. Negative amounts '
  'are clamped to 0. Returns NULL if the wallet has no players row.';

revoke all on function public.add_player_gold(text, bigint) from public, anon, authenticated;


-- ==============  migrations/0008_gold_ledger.sql  ==========================

create table if not exists public.gold_ledger (
  id         bigint generated always as identity primary key,
  wallet     text    not null references public.players (wallet) on delete cascade,
  delta      bigint  not null,
  reason     text    not null,
  created_at timestamptz not null default now()
);

create index if not exists gold_ledger_wallet_idx
  on public.gold_ledger (wallet, created_at desc);

alter table public.gold_ledger enable row level security;
drop policy if exists "gold_ledger readable by anyone" on public.gold_ledger;
create policy "gold_ledger readable by anyone"
  on public.gold_ledger for select using (true);


-- ============  migrations/0009_property_resale.sql  ========================

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


-- ============  migrations/0010_nft_mint_claims.sql  =========================

create table if not exists public.nft_mint_claims (
  id             uuid primary key default gen_random_uuid(),
  tx_signature   text not null unique,
  wallet         text not null,
  asset_address  text not null,
  created_at     timestamptz not null default now()
);

create index if not exists nft_mint_claims_wallet_idx on public.nft_mint_claims (wallet);

alter table public.nft_mint_claims enable row level security;
drop policy if exists "nft_mint_claims readable by anyone" on public.nft_mint_claims;
create policy "nft_mint_claims readable by anyone"
  on public.nft_mint_claims for select using (true);


-- ============  migrations/0011_property_nfts.sql  ============================

alter table public.properties
  add column if not exists asset_address     text,
  add column if not exists non_transferable  boolean not null default false;

create unique index if not exists properties_asset_address_idx
  on public.properties (asset_address) where asset_address is not null;

create table if not exists public.property_mint_claims (
  id             uuid primary key default gen_random_uuid(),
  tx_signature   text not null unique,
  wallet         text not null,
  property_id    text not null references public.properties (id),
  asset_address  text not null,
  created_at     timestamptz not null default now()
);

create index if not exists property_mint_claims_wallet_idx on public.property_mint_claims (wallet);

alter table public.property_mint_claims enable row level security;
drop policy if exists "property_mint_claims readable by anyone" on public.property_mint_claims;
create policy "property_mint_claims readable by anyone"
  on public.property_mint_claims for select using (true);


-- ============  migrations/0012_property_metadata_uri.sql  ====================

alter table public.properties
  add column if not exists metadata_uri text;
