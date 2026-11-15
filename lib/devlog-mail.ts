/**
 * Email the team when the /devlog to-do list changes (a task added or
 * ticked off). Sent through Resend's HTTP API. Off until these are set in
 * Vercel:
 *   RESEND_API_KEY     - from resend.com
 *   DEVLOG_NOTIFY_TO   - comma-separated recipients
 *   DEVLOG_MAIL_FROM   - optional, e.g. "Astrochimpz Dev Log <devlog@astrochimpz.com>"
 *                        (the domain must be verified in Resend)
 * Mail carries only the task text and a link; the page itself stays behind
 * the PIN. Server-only; failures are logged, never thrown, so a mail
 * problem can't break the page.
 */
const DEVLOG_URL = "https://astrochimpz.com/devlog";

export async function sendDevlogMail(subject: string, lines: (string | null | undefined)[]) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.DEVLOG_NOTIFY_TO?.split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || !to?.length) return;

  const text = [...lines.filter(Boolean), "", `Open the dev log: ${DEVLOG_URL}`].join("\n");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.DEVLOG_MAIL_FROM || "Astrochimpz Dev Log <onboarding@resend.dev>",
        to,
        subject: `[Dev log] ${subject}`,
        text,
      }),
    });
    if (!res.ok) console.error("devlog mail failed", res.status, await res.text());
  } catch (e) {
    console.error("devlog mail failed", e);
  }
}
