"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEVLOG_COOKIE, devlogToken, pinMatches } from "@/lib/devlog";

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
