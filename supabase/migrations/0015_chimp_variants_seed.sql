-- ==========================================================================
-- CHIMP Arena - migration 0015: Astrochimp one-of-one catalog seed
-- Run in the Supabase SQL editor AFTER 0014. Safe to re-run (on conflict
-- do nothing - never overwrites a row that's already been claimed/minted).
--
-- 5 one-of-ones to start, feeding two things: the regular 5% random draw on
-- every mint, and the guaranteed bonus every 1000th mint (see
-- next_chimp_mint_number in 0014). More rows can be inserted later as new
-- unique designs get made - this isn't meant to be the final/only 5 forever,
-- just enough to launch with. Names/blurbs are placeholders.
-- ==========================================================================

insert into public.chimp_variants (id, name, blurb) values
  ('chimp-1of1-founder', 'The Founder', 'The one-of-one Astrochimp for whoever was there at the start.'),
  ('chimp-1of1-comet-marshal', 'Comet Marshal', 'A unique Astrochimp commanding the frontier lanes. Only one exists.'),
  ('chimp-1of1-first-signal', 'The First Signal', 'The Astrochimp who sent the first broadcast out of AstroWorld. Only one exists.'),
  ('chimp-1of1-warden', 'Warden of AstroWorld', 'A unique Astrochimp keeping order across the zones. Only one exists.'),
  ('chimp-1of1-last-astronaut', 'The Last Astronaut', 'A unique Astrochimp, the last to leave the old world behind. Only one exists.')
on conflict (id) do nothing;
