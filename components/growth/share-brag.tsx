"use client";

import { useState } from "react";
import { Check, Copy, Download, Send } from "lucide-react";
import { SITE_ORIGIN } from "@/lib/site";
import { SOCIAL_LINKS } from "@/lib/links";

/**
 * Brag buttons (devlog #30): Post on X, Brag in Telegram, Save image, Copy
 * link. Every link is the player's /p/<code> page, which previews as their
 * card on X and Telegram and credits them for anyone who signs up through
 * it. The checklist flags (lib: CHECKLIST_KEYS) are per-browser hints only -
 * we can't see whether a post was really made until the priority-score
 * check lands (#24).
 */
export const CHECKLIST_KEYS = { shared: "ac_shared", telegram: "ac_telegram" } as const;

const TELEGRAM_GROUP = SOCIAL_LINKS.find((s) => s.name === "Telegram")!.href;

export function markDone(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // storage blocked (private mode) - the checklist just won't tick
  }
}

const X_ICON =
  "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";

export function ShareBrag({
  refCode,
  missionSlug,
  text,
  compact = false,
}: {
  refCode: string | null;
  missionSlug?: string;
  /** The post's words; the link is added separately. */
  text: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!refCode) return null;

  const query = missionSlug ? `?m=${encodeURIComponent(missionSlug)}` : "";
  const link = `${SITE_ORIGIN}/p/${refCode}${query}`;
  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const btn = compact ? "hud-btn !px-3 !py-2 !text-[0.7rem]" : "hud-btn !py-2 !text-[0.75rem]";

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      setCopied(true);
      markDone(CHECKLIST_KEYS.shared);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable - the other buttons still work
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => markDone(CHECKLIST_KEYS.shared)}
        className={`${btn} inline-flex items-center gap-2`}
      >
        <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true">
          <path d={X_ICON} />
        </svg>
        Post on X
      </a>
      <a
        href={tgUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => markDone(CHECKLIST_KEYS.shared)}
        className={`${btn} inline-flex items-center gap-2`}
      >
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        Brag in Telegram
      </a>
      <a
        href={`/api/card/${refCode}${query}`}
        download={`astrochimpz-${missionSlug ?? "pilot"}.png`}
        onClick={() => markDone(CHECKLIST_KEYS.shared)}
        className={`${btn} hud-btn-ghost inline-flex items-center gap-2`}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Save image
      </a>
      <button type="button" onClick={copy} className={`${btn} hud-btn-ghost inline-flex items-center gap-2`}>
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

/** "Join the Telegram" - ticks the checklist item when clicked. */
export function JoinTelegram({ className = "hud-btn hud-btn-ghost !py-2 !text-[0.75rem]" }: { className?: string }) {
  return (
    <a
      href={TELEGRAM_GROUP}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => markDone(CHECKLIST_KEYS.telegram)}
      className={`${className} inline-flex items-center gap-2`}
    >
      <Send className="h-3.5 w-3.5" aria-hidden="true" />
      Join the Telegram
    </a>
  );
}
