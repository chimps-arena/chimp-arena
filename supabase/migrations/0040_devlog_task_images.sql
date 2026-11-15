-- ==========================================================================
-- CHIMP Arena - migration 0040: images on dev log to-do tasks
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- Screenshots attached to /devlog tasks. The files live in a PRIVATE
-- storage bucket ("devlog") and are only ever shown through short-lived
-- signed links on the PIN-locked page; this table records which belong to
-- which task. Server-only, like the tasks themselves.
-- ==========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('devlog', 'devlog', false, 4194304, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create table if not exists public.devlog_task_images (
  id          bigserial primary key,
  task_id     bigint not null references public.devlog_tasks(id) on delete cascade,
  path        text not null unique,
  added_by    text check (length(added_by) <= 40),
  created_at  timestamptz not null default now()
);

create index if not exists devlog_task_images_task_idx on public.devlog_task_images (task_id, created_at);

alter table public.devlog_task_images enable row level security;
revoke all on public.devlog_task_images from anon, authenticated;
