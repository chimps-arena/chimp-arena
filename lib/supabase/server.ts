import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client for use ONLY in route handlers / server code.
 * Bypasses Row Level Security - never import this into a client component.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const { supabaseUrl, serviceRoleKey } = serverEnv();
  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
