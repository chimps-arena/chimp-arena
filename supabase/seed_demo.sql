-- Optional: a handful of demo players so the leaderboard isn't empty while
-- you test. These wallets are fake (not valid base58 keypairs) - they can
-- never sign in, they only populate the board. Delete anytime:
--   delete from public.players where wallet like 'DEMO%';

insert into public.players (wallet, handle, crew_slug, xp) values
  ('DEMO_banana_01', 'ApeVanguard',   'banana-bloc',       4820),
  ('DEMO_banana_02', 'PeelDealer',    'banana-bloc',       2610),
  ('DEMO_jungle_01', 'CanopyKing',    'jungle-syndicate',  5375),
  ('DEMO_jungle_02', 'VineWhisperer', 'jungle-syndicate',  1890),
  ('DEMO_rocket_01', 'OrbitPrimate',  'rocket-primates',   6120),
  ('DEMO_rocket_02', 'ThrustMonkey',  'rocket-primates',   3040),
  ('DEMO_thunder_01','StormTail',     'thunder-apes',      4460),
  ('DEMO_thunder_02','BoltBanana',    'thunder-apes',      2720)
on conflict (wallet) do nothing;
