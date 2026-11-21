-- ==========================================================================
-- CHIMP Arena - migration 0041: email sign-ups for launch news
-- Run in the Supabase SQL editor BEFORE deploying. Safe to re-run.
--
-- The homepage "Where we're going" section (devlog #10) lets visitors leave
-- an email to hear when Astroworld and the next drops go live. Written only
-- by app/api/signup with the service role; no public access at all. No
-- emails are sent yet - this is the list we'll use once Resend is set up.
-- ==========================================================================

create table if not exists public.launch_signups (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  -- stored lower-cased and trimmed, so the unique index catches repeats
  email            text not null check (length(email) between 3 and 254),
  source           text check (length(source) <= 40),
  unsubscribed_at  timestamptz
);

create unique index if not exists launch_signups_email_idx
  on public.launch_signups (email);
create index if not exists launch_signups_created_idx
  on public.launch_signups (created_at);

alter table public.launch_signups enable row level security;
revoke all on public.launch_signups from anon, authenticated;
