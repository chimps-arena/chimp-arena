-- ==========================================================================
-- CHIMP Arena - migration 0027: real named character art (Common/Rare/1of1)
-- Run in the Supabase SQL editor AFTER 0026. Safe to re-run.
--
-- Replaces the placeholder "Standard Ember"/"Rare Voidwalker"-style rows
-- from migration 0016 with 42 real named characters (21 Common = tier
-- 'standard', 21 Rare) supplied by the founder, plus adds 5 real One of One
-- names alongside the existing placeholder ones in migration 0015.
--
-- chimp_style_variants rows are safe to delete outright: image_url has
-- always been null for every one of them (no art ever existed), and
-- /api/mint/claim's pickStyleVariant() only ever draws from rows where
-- image_url is set - so none of these ids could have been minted into a
-- real NFT's metadata URI yet. Confirmed nothing else references this
-- table's id by foreign key either.
--
-- chimp_variants (One of One) is different: pickOneOfOne() does NOT filter
-- on image_url, so a placeholder-named row could already be sitting inside
-- a real minted NFT's metadata URI if a milestone has fired. Renaming those
-- in place would retroactively change what an already-minted NFT displays -
-- so old rows are left untouched here; the 5 real names are added as new
-- rows instead, old placeholders only get removed if nothing in
-- chimp_milestones ever actually pointed at them.
--
-- image_url for everything below stays null until scripts/upload-chimp-art.mjs
-- uploads the actual files and sets it - same pattern as 0016's original
-- seed. Asher (Common) is deliberately left out of the upload step for now
-- (visible Nike branding in the art - flagged for the founder, not uploaded
-- until resolved), but its row is still seeded here so it's ready the
-- moment replacement art lands.
-- ==========================================================================

delete from public.chimp_style_variants
 where id in (
   'std-ember','std-frost','std-verdant','std-voltage','std-slate',
   'std-rosewater','std-copper','std-indigo','std-sand','std-mint',
   'rare-voidwalker','rare-aurora','rare-magnetar','rare-solflare',
   'rare-deepcore','rare-wraith'
 );

insert into public.chimp_style_variants (id, tier, name) values
  ('std-alena-the-wrench', 'standard', 'Alena The Wrench'),
  ('std-alisa', 'standard', 'Alisa'),
  ('std-asher', 'standard', 'Asher'),
  ('std-astrodog', 'standard', 'Astrodog'),
  ('std-astrogaurd-safu-security', 'standard', 'Astrogaurd - Safu Security'),
  ('std-astrokitty', 'standard', 'Astrokitty'),
  ('std-big-time-danny', 'standard', 'Big Time Danny'),
  ('std-big-trader-joe', 'standard', 'Big Trader Joe'),
  ('std-billy-the-chimp', 'standard', 'Billy the Chimp'),
  ('std-castro', 'standard', 'Castro'),
  ('std-dan-the-bolt', 'standard', 'Dan The Bolt'),
  ('std-dave-from-dock-7', 'standard', 'Dave From Dock 7'),
  ('std-death', 'standard', 'Death'),
  ('std-drink-mixer', 'standard', 'Drink Mixer'),
  ('std-lan-the-racecar-driver', 'standard', 'Lan The Racecar Driver'),
  ('std-missy-wif-you', 'standard', 'Missy Wif You'),
  ('std-pompus-the-first', 'standard', 'Pompus The First'),
  ('std-sneako', 'standard', 'Sneako'),
  ('std-techno-left-the-building', 'standard', 'Techno Left The Building'),
  ('std-undercover-dave', 'standard', 'Undercover Dave'),
  ('std-weapon-specialist-ryan', 'standard', 'Weapon Specialist Ryan'),
  ('rare-apex-rex', 'rare', 'Apex Rex'),
  ('rare-aria', 'rare', 'Aria'),
  ('rare-ash-cold', 'rare', 'Ash Cold'),
  ('rare-atisha-the-b', 'rare', 'Atisha The B'),
  ('rare-bad-mike', 'rare', 'Bad Mike'),
  ('rare-bertha-brick-hit', 'rare', 'Bertha Brick Hit'),
  ('rare-caesar', 'rare', 'Caesar'),
  ('rare-deezy-chimp', 'rare', 'Deezy Chimp'),
  ('rare-ella', 'rare', 'Ella'),
  ('rare-eva', 'rare', 'Eva'),
  ('rare-foxtrot', 'rare', 'Foxtrot'),
  ('rare-isabella', 'rare', 'Isabella'),
  ('rare-kanuchi', 'rare', 'Kanuchi'),
  ('rare-lady-winter', 'rare', 'Lady Winter'),
  ('rare-lord-julian', 'rare', 'Lord Julian'),
  ('rare-lucian', 'rare', 'Lucian'),
  ('rare-major-mike', 'rare', 'Major Mike'),
  ('rare-rambo', 'rare', 'Rambo'),
  ('rare-senex', 'rare', 'Senex'),
  ('rare-soloman', 'rare', 'Soloman'),
  ('rare-victoria', 'rare', 'Victoria')
on conflict (id) do nothing;

-- Old placeholder One of One rows (migration 0015) - only remove ones that
-- were never actually handed out by the milestone bonus.
delete from public.chimp_variants
 where id in (
   'chimp-1of1-founder','chimp-1of1-comet-marshal','chimp-1of1-first-signal',
   'chimp-1of1-warden','chimp-1of1-last-astronaut'
 )
 and not exists (
   select 1 from public.chimp_milestones m where m.variant_id = chimp_variants.id
 );

insert into public.chimp_variants (id, tier, name, blurb) values
  ('chimp-1of1-cleopatra', 'one_of_one', 'Cleopatra', 'A unique Astrochimp ruling her own corner of AstroWorld. Only one exists.'),
  ('chimp-1of1-dex', 'one_of_one', 'Dex', 'A unique Astrochimp who knows every back channel in AstroWorld. Only one exists.'),
  ('chimp-1of1-kill-boy-tommy', 'one_of_one', 'Kill Boy Tommy', 'A unique Astrochimp nobody crosses twice. Only one exists.'),
  ('chimp-1of1-lex', 'one_of_one', 'Lex', 'A unique Astrochimp, sharp and always three moves ahead. Only one exists.'),
  ('chimp-1of1-napoleon', 'one_of_one', 'Napoleon', 'A unique Astrochimp who crowned himself and made it stick. Only one exists.')
on conflict (id) do nothing;
