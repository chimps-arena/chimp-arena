"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendDevlogMail } from "@/lib/devlog-mail";
import { DEVLOG_BUCKET, DEVLOG_COOKIE, devlogToken, pinMatches, tokenValid } from "@/lib/devlog";

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

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES_PER_SEND = 4;

/** Stores the images picked in a form against a task; skips anything that
 *  isn't a reasonably sized image (the page shrinks big photos first). */
async function saveImages(taskId: number, formData: FormData) {
  const db = supabaseAdmin();
  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0 && f.size <= MAX_IMAGE_BYTES && f.type in IMAGE_TYPES)
    .slice(0, MAX_IMAGES_PER_SEND);
  for (const file of files) {
    const path = `tasks/${taskId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${IMAGE_TYPES[file.type]}`;
    const { error } = await db.storage.from(DEVLOG_BUCKET).upload(path, file, { contentType: file.type });
    if (!error) {
      await db.from("devlog_task_images").insert({ task_id: taskId, path, added_by: text(formData.get("addedBy"), 40) });
    }
  }
}

export async function addTask(formData: FormData) {
  await requireUnlocked();
  const title = text(formData.get("title"), 300);
  if (title) {
    const addedBy = text(formData.get("addedBy"), 40);
    const details = text(formData.get("details"), 2000);
    const urgent = formData.get("urgent") === "on";
    const { data: task } = await supabaseAdmin()
      .from("devlog_tasks")
      .insert({ title, details, added_by: addedBy, urgent })
      .select("id")
      .single();
    if (task) {
      await saveImages(task.id, formData);
      after(() =>
        sendDevlogMail(`${urgent ? "URGENT task" : "New task"} #${task.id}: ${title}`, [
          `${urgent ? "Urgent task" : "New task"} #${task.id}${addedBy ? `, added by ${addedBy}` : ""}:`,
          title,
          details && `\n${details}`,
        ]),
      );
    }
    // Remember the name for the next task this browser adds.
    if (addedBy) {
      (await cookies()).set("devlog_name", addedBy, { path: "/devlog", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
  }
  redirect("/devlog#todo");
}

export async function attachImages(id: number, formData: FormData) {
  await requireUnlocked();
  formData.set("addedBy", (await cookies()).get("devlog_name")?.value ?? "");
  await saveImages(id, formData);
  redirect("/devlog#todo");
}

export async function completeTask(id: number, formData: FormData) {
  await requireUnlocked();
  const note = text(formData.get("note"), 500);
  const { data: task } = await supabaseAdmin()
    .from("devlog_tasks")
    .update({ done_at: new Date().toISOString(), done_note: note })
    .eq("id", id)
    .is("done_at", null)
    .select("title, created_at")
    .maybeSingle();
  if (task) {
    const days = Math.floor((Date.now() - Date.parse(task.created_at)) / 86_400_000);
    after(() =>
      sendDevlogMail(`Done #${id}: ${task.title}`, [
        `Task #${id} was marked done after ${days} day${days === 1 ? "" : "s"}:`,
        task.title,
        note && `\nWhat was done: ${note}`,
      ]),
    );
  }
  redirect("/devlog#todo");
}

export async function reopenTask(id: number) {
  await requireUnlocked();
  await supabaseAdmin().from("devlog_tasks").update({ done_at: null, done_note: null }).eq("id", id);
  redirect("/devlog#todo");
}
