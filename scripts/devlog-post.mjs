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

// Same team email as lib/devlog-mail.ts, if RESEND_API_KEY and
// DEVLOG_NOTIFY_TO are in .env.local.
const to = process.env.DEVLOG_NOTIFY_TO?.split(",").map((x) => x.trim()).filter(Boolean);
if (process.env.RESEND_API_KEY && to?.length) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.DEVLOG_MAIL_FROM || "Astrochimpz Dev Log <onboarding@resend.dev>",
      to,
      subject: `[Dev log] New update: ${title}`,
      text: `${body.replace(/\*\*/g, "")}\n\nOpen the dev log: https://astrochimpz.com/devlog`,
    }),
  });
  console.log(res.ok ? "emailed the team" : `email failed: ${res.status} ${await res.text()}`);
}
