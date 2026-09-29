-- ==========================================================================
-- CHIMP Arena - migration 0016: art variety for Standard and Rare
-- Run in the Supabase SQL editor AFTER 0015. Safe to re-run.
--
-- Standard and Rare mint indefinitely (see migration 0014's note on why
-- they're not a finite catalog like One of One) - but that doesn't mean
-- every Standard mint should share one identical placeholder image. This
-- is a pool of reusable "skins" within each tier: no claiming, no
-- scarcity, no asset_address - a row here can be handed out to any number
-- of mints. /api/mint/claim picks one at random per mint once image_url is
-- set; until then it falls back to the old shared per-tier placeholder
-- (app/nft/chimp-metadata/tier/[tier]), so this is safe to run before any
-- art exists.
-- ==========================================================================

create table if not exists public.chimp_style_variants (
  id            text primary key,
  tier          text not null check (tier in ('standard', 'rare')),
  name          text not null,
  image_url     text,
  metadata_uri  text
);

create index if not exists chimp_style_variants_tier_ready_idx
  on public.chimp_style_variants (tier) where image_url is not null;

alter table public.chimp_style_variants enable row level security;
drop policy if exists "chimp_style_variants readable by anyone" on public.chimp_style_variants;
create policy "chimp_style_variants readable by anyone"
  on public.chimp_style_variants for select using (true);

insert into public.chimp_style_variants (id, tier, name) values
  ('std-ember', 'standard', 'Standard Ember'),
  ('std-frost', 'standard', 'Standard Frost'),
  ('std-verdant', 'standard', 'Standard Verdant'),
  ('std-voltage', 'standard', 'Standard Voltage'),
  ('std-slate', 'standard', 'Standard Slate'),
  ('std-rosewater', 'standard', 'Standard Rosewater'),
  ('std-copper', 'standard', 'Standard Copper'),
  ('std-indigo', 'standard', 'Standard Indigo'),
  ('std-sand', 'standard', 'Standard Sand'),
  ('std-mint', 'standard', 'Standard Mint'),
  ('rare-voidwalker', 'rare', 'Rare Voidwalker'),
  ('rare-aurora', 'rare', 'Rare Aurora'),
  ('rare-magnetar', 'rare', 'Rare Magnetar'),
  ('rare-solflare', 'rare', 'Rare Solflare'),
  ('rare-deepcore', 'rare', 'Rare Deepcore'),
  ('rare-wraith', 'rare', 'Rare Wraith')
on conflict (id) do nothing;
