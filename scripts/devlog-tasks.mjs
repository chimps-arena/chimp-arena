// Prints the team's open to-do items from /devlog, urgent first - read at
// the start of every work session so nothing gets skipped.
//   node --env-file=.env.local scripts/devlog-tasks.mjs
// Read-only; tasks are ticked off on the page itself.
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await db
  .from("devlog_tasks")
  .select("id, created_at, title, details, added_by, urgent")
  .is("done_at", null)
  .order("urgent", { ascending: false })
  .order("created_at", { ascending: true });
if (error) throw error;

if (!data.length) console.log("No open tasks.");
for (const t of data) {
  console.log(`#${t.id}${t.urgent ? " [URGENT]" : ""} ${t.title}  (${t.created_at.slice(0, 10)}${t.added_by ? `, ${t.added_by}` : ""})`);
  if (t.details) console.log(`    ${t.details.replace(/\n/g, "\n    ")}`);
}
