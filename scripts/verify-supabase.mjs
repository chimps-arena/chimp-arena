/**
 * Verifies the Supabase project is reachable and setup.sql ran correctly.
 *
 *   npm run verify:db
 *
 * Reads .env.local, connects with the service-role key, and checks every
 * table, view and function the app depends on.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  let text;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    fail(".env.local not found - copy .env.local.example and fill it in.");
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}
function ok(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || url.includes("YOUR-PROJECT")) fail("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local");
if (!key || key.startsWith("your-")) fail("SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
ok(`env loaded — project ${url}`);

const db = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
async function check(label, fn) {
  try {
    const err = await fn();
    if (err) {
      console.error(`\x1b[31m✗ ${label} — ${err}\x1b[0m`);
      failures++;
    } else {
      ok(label);
    }
  } catch (e) {
    console.error(`\x1b[31m✗ ${label} — ${e.message}\x1b[0m`);
    failures++;
  }
}

const tableExists = (t) => async () => {
  const { error } = await db.from(t).select("*", { head: true, count: "exact" }).limit(0);
  return error ? error.message : null;
};

await check("table: players", tableExists("players"));
await check("table: mission_runs", tableExists("mission_runs"));
await check("table: weekly_scores", tableExists("weekly_scores"));
await check("table: weekly_pools", tableExists("weekly_pools"));
await check("table: weekly_allocations", tableExists("weekly_allocations"));
await check("table: daily_bonuses", tableExists("daily_bonuses"));
await check("view: crew_totals", tableExists("crew_totals"));
await check("view: weekly_xp_live", tableExists("weekly_xp_live"));

await check("function: add_player_xp", async () => {
  // Non-existent wallet -> UPDATE hits 0 rows -> returns null, no error.
  const { data, error } = await db.rpc("add_player_xp", {
    p_wallet: "__verify_nonexistent__",
    p_amount: 0,
  });
  if (error) return error.message;
  if (data !== null) return `expected null for unknown wallet, got ${JSON.stringify(data)}`;
  return null;
});

await check("function: freeze_week", async () => {
  const { data, error } = await db.rpc("freeze_week", { p_week_start: "1970-01-05" });
  if (error) return error.message;
  if (typeof data !== "number") return `expected a number, got ${JSON.stringify(data)}`;
  return null;
});

await check("function: bump_streak", async () => {
  const { data, error } = await db
    .rpc("bump_streak", { p_wallet: "__verify_nonexistent__", p_today: "1970-01-05" })
    .maybeSingle();
  if (error) return error.message;
  if (!data || data.streak_count !== 0) {
    return `expected {streak_count:0} for unknown wallet, got ${JSON.stringify(data)}`;
  }
  return null;
});

console.log("");
if (failures) {
  fail(`${failures} check(s) failed — run supabase/setup.sql in the SQL editor.`);
} else {
  ok("all checks passed — database is ready.");
}
