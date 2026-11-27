"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Lamp, tint } from "@/components/hud";
import { utcDay } from "@/lib/game/config";

/**
 * "Welcome back" popup (devlog #28). On a player's first visit each UTC
 * day: their name, a small XP gift (more after a few days away) and today's
 * mission. Collecting plays a short chime - it runs on the click, so
 * browsers allow the sound. Closing the popup any other way still collects
 * the gift; it's theirs either way.
 */
const SEEN_KEY = "ac_welcome_seen";
const SKIP = ["/admin", "/devlog", "/legal", "/p/"];

type Offer = { eligible: boolean; xp: number; daysAway: number };

function seenToday(wallet: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === `${wallet}:${utcDay()}`;
  } catch {
    return false;
  }
}
function markSeen(wallet: string) {
  try {
    localStorage.setItem(SEEN_KEY, `${wallet}:${utcDay()}`);
  } catch {
    // storage blocked - the server still only pays once a day
  }
}

/** A bright three-note "coin" chime, synthesized - no audio file needed. */
function playWelcomeChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [659.25, 987.77, 1318.51].forEach((freq, i) => {
      const start = now + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // no Web Audio - the popup works silently
  }
}

async function quietCollect(wallet: string) {
  markSeen(wallet);
  try {
    await fetch("/api/welcome-back", { method: "POST" });
  } catch {
    // tomorrow's popup still works
  }
}

export function WelcomeBack() {
  const { me, refresh } = useSession();
  const pathname = usePathname();
  const wallet = me?.player?.wallet ?? null;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [state, setState] = useState<"offer" | "done">("offer");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const skip = SKIP.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!wallet || skip || seenToday(wallet)) return;
    let alive = true;
    fetch("/api/welcome-back", { cache: "no-store" })
      .then((r) => r.json() as Promise<Offer>)
      .then((o) => {
        if (!alive) return;
        if (o.eligible) setOffer(o);
        else markSeen(wallet);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [wallet, skip]);

  useEffect(() => {
    if (offer) buttonRef.current?.focus();
  }, [offer]);

  // Escape closes, wherever focus is. Collecting is idempotent on the
  // server (once per day), so closing after "Collect" is harmless.
  useEffect(() => {
    if (!offer || !wallet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOffer(null);
      void quietCollect(wallet).then(refresh);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offer, wallet, refresh]);

  if (!offer || !wallet || !me?.player) return null;

  // The burst + chime happen on the click itself; the save finishes behind it.
  const collect = (withSound: boolean) => {
    if (state !== "offer") return;
    setState("done");
    if (withSound) playWelcomeChime();
    void quietCollect(wallet).then(refresh);
  };
  const close = () => {
    if (state === "offer") collect(false);
    setOffer(null);
  };

  const next = me.today.missions.filter((m) => !m.def.comingSoon && !m.completed)[0];
  const away = offer.daysAway >= 3;
  const color = "var(--hud-amber)";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-back-title"
        className="hud hud-panel welcome-pop flex w-full max-w-sm flex-col items-center gap-4 p-7 text-center"
        style={{ ...tint(color), "--cut": "22px" } as React.CSSProperties}
      >
        <div className="hud-label flex items-center gap-2" style={{ color }}>
          <Lamp color={color} live /> {away ? "Pilot sighted" : "Daily check-in"}
        </div>
        <Image
          src="/brand/chimp-logo-200.png"
          alt=""
          width={72}
          height={72}
          className="float-y rounded-full drop-shadow-[0_0_24px_rgba(245,197,24,0.45)]"
        />
        <h2 id="welcome-back-title" className="text-2xl font-bold uppercase leading-tight">
          Welcome back,
          <br />
          <span style={{ color }}>{me.player.handle}</span>
        </h2>
        <p className="text-sm text-muted">
          {away
            ? `${offer.daysAway} days away. The colony missed you. Here's ${offer.xp} XP to get you flying again.`
            : `Good to see you again. Here's ${offer.xp} XP for coming back.`}
        </p>

        <div
          className={`text-4xl font-bold ${state === "done" ? "welcome-xp-in" : ""}`}
          style={{ color }}
          aria-live="polite"
        >
          +{offer.xp} XP
        </div>

        <p className="text-sm">
          {next ? (
            <>
              Today&apos;s mission: <strong>{next.def.title}</strong>
            </>
          ) : (
            "Today's missions are all cleared."
          )}
        </p>

        {state === "done" ? (
          <div className="flex flex-wrap justify-center gap-3">
            {next && (
              <Link href={next.def.href} className="hud-btn" onClick={() => setOffer(null)}>
                Play {next.def.title} ▸
              </Link>
            )}
            <button type="button" className="hud-btn hud-btn-ghost" onClick={() => setOffer(null)}>
              Close
            </button>
          </div>
        ) : (
          <button
            ref={buttonRef}
            type="button"
            className="hud-btn"
            onClick={() => collect(true)}
          >
            Collect +{offer.xp} XP
          </button>
        )}
      </div>
    </div>
  );
}
