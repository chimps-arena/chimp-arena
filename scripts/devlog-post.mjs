// Publishes a written update to the founders' /devlog page.
//   node --env-file=.env.local scripts/devlog-post.mjs <update.md>
// The file's first line is the title; the rest is the body ("## heading",
// "- bullet", blank-line paragraphs). Writes to production via the service
// role, so keep anything the founders shouldn't see out of it.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
if (!file) throw new Error("usage: devlog-post.mjs <update.md>");
const [first, ...rest] = readFileSync(file, "utf8").replace(/\r/g, "").split("\n");
const title = first.replace(/^#\s*/, "").trim();
const body = rest.join("\n").trim();
if (!title || !body) throw new Error("need a title line and a body");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await db.from("devlog_posts").insert({ title, body }).select("id").single();
if (error) throw error;
console.log(`posted #${data.id}: ${title}`);
