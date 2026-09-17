import { existsSync } from "node:fs";
import { join } from "node:path";

const EXTENSIONS = ["jpg", "png", "jpeg", "webp"] as const;

/**
 * Server-only: which image file actually exists for a property type, if any.
 * Resolved once per request in the API route (cheap - a handful of stat
 * calls) rather than guessed client-side, which raced React hydration and
 * left the fallback icon showing even when a real photo existed.
 */
export function resolvePropertyImage(type: string): string | null {
  for (const ext of EXTENSIONS) {
    const rel = `/properties/${type}.${ext}`;
    if (existsSync(join(process.cwd(), "public", rel))) return rel;
  }
  return null;
}
