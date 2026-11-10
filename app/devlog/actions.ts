"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { DEVLOG_COOKIE, devlogToken, pinMatches, tokenValid } from "@/lib/devlog";

export async function unlockDevlog(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const token = devlogToken();
  if (!token || !pinMatches(pin)) {
    // Slows guessing down; a 4-digit PIN only keeps casual visitors out.
    await new Promise((r) => setTimeout(r, 1000));
    redirect("/devlog?wrong=1");
  }
  (await cookies()).set(DEVLOG_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/devlog",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/devlog");
}

export async function lockDevlog() {
  (await cookies()).delete({ name: DEVLOG_COOKIE, path: "/devlog" });
  redirect("/devlog");
}

/** Every task action re-checks the PIN cookie - actions are callable directly. */
async function requireUnlocked() {
  if (!tokenValid((await cookies()).get(DEVLOG_COOKIE)?.value)) redirect("/devlog");
}

const text = (v: FormDataEntryValue | null, max: number) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

export async function addTask(formData: FormData) {
  await requireUnlocked();
  const title = text(formData.get("title"), 300);
  if (title) {
    const addedBy = text(formData.get("addedBy"), 40);
    await supabaseAdmin().from("devlog_tasks").insert({
      title,
      details: text(formData.get("details"), 2000),
      added_by: addedBy,
      urgent: formData.get("urgent") === "on",
    });
    // Remember the name for the next task this browser adds.
    if (addedBy) {
      (await cookies()).set("devlog_name", addedBy, { path: "/devlog", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
  }
  redirect("/devlog#todo");
}

export async function completeTask(id: number, formData: FormData) {
  await requireUnlocked();
  await supabaseAdmin()
    .from("devlog_tasks")
    .update({ done_at: new Date().toISOString(), done_note: text(formData.get("note"), 500) })
    .eq("id", id)
    .is("done_at", null);
  redirect("/devlog#todo");
}

export async function reopenTask(id: number) {
  await requireUnlocked();
  await supabaseAdmin().from("devlog_tasks").update({ done_at: null, done_note: null }).eq("id", id);
  redirect("/devlog#todo");
}
