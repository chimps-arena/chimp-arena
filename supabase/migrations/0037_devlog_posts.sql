-- ==========================================================================
-- CHIMP Arena - migration 0037: founders' dev log updates
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- The written progress updates shown on the PIN-locked /devlog page. They
-- live here rather than in the repo because the repo is public and these
-- name open decisions, blockers and money owed. Written by
-- scripts/devlog-post.mjs with the service role; no public access at all.
-- ==========================================================================

create table if not exists public.devlog_posts (
  id         bigserial primary key,
  posted_at  timestamptz not null default now(),
  title      text not null,
  -- light markdown: "## heading", "- bullet", blank-line paragraphs
  body       text not null
);

create index if not exists devlog_posts_posted_at_idx
  on public.devlog_posts (posted_at desc);

alter table public.devlog_posts enable row level security;
revoke all on public.devlog_posts from anon, authenticated;
