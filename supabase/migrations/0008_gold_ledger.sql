-- ==========================================================================
-- CHIMP Arena - migration 0008: Gold ledger (Safu Bank activity feed)
-- Run in the Supabase SQL editor AFTER 0007. Safe to re-run.
--
-- players.gold stays the fast running total; this table is the append-only
-- history behind it, so Safu Bank can show real recent activity instead of
-- just a number. Server-only writes (route handlers), same as everything else.
-- ==========================================================================

create table if not exists public.gold_ledger (
  id         bigint generated always as identity primary key,
  wallet     text    not null references public.players (wallet) on delete cascade,
  delta      bigint  not null,
  reason     text    not null, -- e.g. 'mission:reaction', 'streak:7'
  created_at timestamptz not null default now()
);

create index if not exists gold_ledger_wallet_idx
  on public.gold_ledger (wallet, created_at desc);

alter table public.gold_ledger enable row level security;
drop policy if exists "gold_ledger readable by anyone" on public.gold_ledger;
create policy "gold_ledger readable by anyone"
  on public.gold_ledger for select using (true);
-- No insert/update/delete policy: all writes go through the service-role key.
