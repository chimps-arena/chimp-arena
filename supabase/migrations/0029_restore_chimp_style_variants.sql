-- ==========================================================================
-- CHIMP Arena - migration 0029: restore (but retire) the Sep-29 style rows
-- Run in the Supabase SQL editor AFTER 0028. Safe to re-run.
--
-- Migration 0027 deleted these 16 rows on the wrong assumption that they'd
-- never had real art uploaded (the seed in migration 0016 itself never sets
-- image_url). In fact migration dc9634f ("feat(mint): art variety for
-- Standard/Rare, real Astrochimp art live", 2026-09-29) uploaded real art
-- for all 16 that same day, and /api/mint/claim has been drawing from them
-- ever since - 27 real mints have tier set (standard/rare) as of this fix,
-- meaning some number of them almost certainly baked one of these ids into
-- their permanent on-chain metadata URI (/nft/chimp-metadata/style/<id>).
-- Deleting the row broke that URI for whoever already holds one.
--
-- The founder's call (2026-10-14): the new Common/Rare folder is a
-- deliberate replacement - these 16 should never be handed out to a new
-- mint again. So this restores the rows (image_url refilled by
-- scripts/restore-chimp-style-art.mjs) but marks them `retired`, which
-- pickStyleVariant() now excludes from the random draw. Already-minted
-- NFTs look up their style by id directly (not through the draw), so
-- their metadata resolves again regardless of this flag.
-- ==========================================================================

alter table public.chimp_style_variants
  add column if not exists retired boolean not null default false;

insert into public.chimp_style_variants (id, tier, name, retired) values
  ('std-ember', 'standard', 'Standard Ember', true),
  ('std-frost', 'standard', 'Standard Frost', true),
  ('std-verdant', 'standard', 'Standard Verdant', true),
  ('std-voltage', 'standard', 'Standard Voltage', true),
  ('std-slate', 'standard', 'Standard Slate', true),
  ('std-rosewater', 'standard', 'Standard Rosewater', true),
  ('std-copper', 'standard', 'Standard Copper', true),
  ('std-indigo', 'standard', 'Standard Indigo', true),
  ('std-sand', 'standard', 'Standard Sand', true),
  ('std-mint', 'standard', 'Standard Mint', true),
  ('rare-voidwalker', 'rare', 'Rare Voidwalker', true),
  ('rare-aurora', 'rare', 'Rare Aurora', true),
  ('rare-magnetar', 'rare', 'Rare Magnetar', true),
  ('rare-solflare', 'rare', 'Rare Solflare', true),
  ('rare-deepcore', 'rare', 'Rare Deepcore', true),
  ('rare-wraith', 'rare', 'Rare Wraith', true)
on conflict (id) do update set retired = true;
