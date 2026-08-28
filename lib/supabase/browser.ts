"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_ENV } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Anon Supabase client for the browser. Only used for realtime subscriptions
 * and public reads that are governed by Row Level Security policies.
 */
export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabaseAnonKey, {
    auth: { persistSession: false },
  });
  return cached;
}
