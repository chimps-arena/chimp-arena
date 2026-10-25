-- ==========================================================================
-- CHIMP Arena - migration 0030: mime_type for chimp art
-- Run in the Supabase SQL editor AFTER 0029. Safe to re-run.
--
-- The chimp-metadata routes have always hardcoded `type: "image/png"` in
-- the NFT metadata JSON's properties.files entry. That was harmless while
-- every upload actually was a PNG, but it breaks the moment anything isn't -
-- Irys's image_url is a bare content hash with no file extension, so the
-- metadata JSON's declared type is the only place that information lives.
--
-- This is needed now because the existing art (~1.8-2.3MB unoptimized PNGs,
-- confirmed the cause of intermittent broken images in Phantom/Solana
-- Explorer - investigated 2026-10-25) is being re-exported as WebP, which
-- cut file size ~85% with no visible quality loss on a sample (plain PNG
-- re-compression made files bigger, not smaller - these are photorealistic
-- renders, not flat-color art, so PNG's lossless compression doesn't help).
--
-- Existing rows default to image/png (true for every row as of this
-- migration - the format swap hasn't happened yet). scripts/upload-chimp-art.mjs
-- already knows each file's real content type and is updated to write it
-- here going forward.
-- ==========================================================================

alter table public.chimp_style_variants
  add column if not exists mime_type text not null default 'image/png';

alter table public.chimp_variants
  add column if not exists mime_type text not null default 'image/png';
