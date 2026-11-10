-- ==========================================================================
-- CHIMP Arena - migration 0038: the team to-do list on /devlog
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- Issues the team adds on the PIN-locked /devlog page so nothing gets
-- skipped; read at the start of every work session
-- (scripts/devlog-tasks.mjs). Written only through the page's server
-- actions and scripts using the service role; no public access at all.
-- ==========================================================================

create table if not exists public.devlog_tasks (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  title       text not null check (length(title) between 1 and 300),
  details     text check (length(details) <= 2000),
  added_by    text check (length(added_by) <= 40),
  urgent      boolean not null default false,
  done_at     timestamptz,
  -- what was done about it, shown once it's ticked off
  done_note   text check (length(done_note) <= 500)
);

create index if not exists devlog_tasks_open_idx
  on public.devlog_tasks (done_at, urgent desc, created_at);

alter table public.devlog_tasks enable row level security;
revoke all on public.devlog_tasks from anon, authenticated;
