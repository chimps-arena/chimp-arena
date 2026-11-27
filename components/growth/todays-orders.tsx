"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Lamp, tint } from "@/components/hud";
import type { MeResponse } from "@/lib/types";
import { CHECKLIST_KEYS, JoinTelegram, ShareBrag } from "@/components/growth/share-brag";

/**
 * Top of Mission Control (devlog #30): answers "what do I do now?" before
 * anything else - the next mission to play, or, once the day is cleared,
 * brag about it and come back at reset.
 */
export function TodaysOrders({ me }: { me: MeResponse }) {
  const playable = me.today.missions.filter((m) => !m.def.comingSoon);
  const left = playable.filter((m) => !m.completed);
  const next = left[0];
  const { streak, crew } = me;
  const allDone = left.length === 0;
  const color = allDone ? "var(--good)" : "var(--hud-amber)";

  const bragText = `Cleared every daily mission in @Astrochimpz today${crew ? ` for ${crew.name}` : ""}${
    streak.count > 1 ? `, ${streak.count}-day streak` : ""
  }. Come fly with me:`;

  return (
    <section className="hud-panel flex flex-col gap-4 p-6" style={{ ...tint(color), "--cut": "22px" } as React.CSSProperties}>
      <div className="hud-label flex items-center gap-2" style={{ color }}>
        <Lamp color={color} live /> Today&apos;s orders
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase leading-tight sm:text-3xl">
            {allDone
              ? "Day cleared. Nice flying."
              : `${left.length} mission${left.length === 1 ? "" : "s"} left today`}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {allDone
              ? `New missions at 00:00 UTC, in ${hoursToReset()}. Show your crew what you did today.`
              : streak.atRisk
                ? `Your ${streak.count}-day streak ends at 00:00 UTC unless you clear one. ${hoursToReset()} left.`
                : streak.count > 0
                  ? `Streak: ${streak.count} day${streak.count === 1 ? "" : "s"}. Every mission adds XP to ${crew?.name ?? "your crew"}.`
                  : "Each mission is a short mini-game. Clear it for XP and start a daily streak."}
          </p>
        </div>
        {!allDone && next && (
          <Link href={next.def.href} className="hud-btn">
            Play {next.def.title} ▸
          </Link>
        )}
      </div>

      {/* one pip per mission */}
      <div className="flex gap-2" aria-label={`${playable.length - left.length} of ${playable.length} missions cleared`}>
        {playable.map((m) => (
          <span
            key={m.def.slug}
            title={m.def.title}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: m.completed ? "var(--good)" : "color-mix(in srgb, var(--hud-edge) 80%, transparent)" }}
          />
        ))}
      </div>

      {allDone && (
        <div className="flex flex-col items-start gap-3">
          <ShareBrag refCode={me.growth?.refCode ?? null} text={bragText} compact />
        </div>
      )}
    </section>
  );
}

function hoursToReset(): string {
  const now = new Date();
  const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(1, Math.round((reset - now.getTime()) / 60_000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

/**
 * New-pilot checklist: the path from first visit to community member.
 * Hidden once everything's done, or when the player hides it.
 */
export function NewPilotChecklist({ me }: { me: MeResponse }) {
  const [flags, setFlags] = useState({ shared: false, telegram: false, hidden: false });

  useEffect(() => {
    const read = () => {
      try {
        setFlags({
          shared: localStorage.getItem(CHECKLIST_KEYS.shared) === "1",
          telegram: localStorage.getItem(CHECKLIST_KEYS.telegram) === "1",
          hidden: localStorage.getItem("ac_checklist_hidden") === "1",
        });
      } catch {
        // storage blocked - show the unticked list
      }
    };
    read();
    // ticks from the buttons below land after a click; re-read on return
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, []);

  const firstMission = me.today.missions.find((m) => !m.def.comingSoon && !m.completed);
  const steps = [
    { done: !!me.crew, label: "Pick your crew", action: <Link href="/crews" className="hud-btn hud-btn-ghost !px-3 !py-1.5 !text-[0.65rem]">Pick ▸</Link> },
    {
      done: (me.player?.xp ?? 0) > 0,
      label: "Clear your first mission",
      action: firstMission ? <Link href={firstMission.def.href} className="hud-btn hud-btn-ghost !px-3 !py-1.5 !text-[0.65rem]">Play ▸</Link> : null,
    },
    { done: flags.telegram, label: "Join the Telegram: brag, trash-talk other crews, get news first", action: <JoinTelegram className="hud-btn hud-btn-ghost !px-3 !py-1.5 !text-[0.65rem]" /> },
    {
      done: flags.shared,
      label: "Share your pilot card. Everyone who joins through your link counts as yours",
      action: (
        <ShareBrag
          refCode={me.growth?.refCode ?? null}
          text={`I'm flying with @Astrochimpz${me.crew ? ` for ${me.crew.name}` : ""}. Daily missions, crew wars, on Solana. Join me:`}
          compact
        />
      ),
    },
    { done: (me.growth?.astrochimpsMinted ?? 0) > 0, label: "Mint your Astrochimp", action: <Link href="/mint" className="hud-btn hud-btn-ghost !px-3 !py-1.5 !text-[0.65rem]">Mint ▸</Link> },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (flags.hidden || doneCount === steps.length) return null;

  function hide() {
    try {
      localStorage.setItem("ac_checklist_hidden", "1");
    } catch {}
    setFlags((f) => ({ ...f, hidden: true }));
  }

  return (
    <section className="hud-panel flex flex-col gap-3 p-5" style={tint("var(--accent-violet)")}>
      <div className="flex items-center justify-between gap-3">
        <span className="hud-label flex items-center gap-2 !text-[color:var(--accent-violet)]">
          <Lamp color="var(--accent-violet)" live /> New pilot checklist · {doneCount}/{steps.length}
        </span>
        <button type="button" onClick={hide} className="text-xs text-muted underline hover:text-foreground">
          Hide
        </button>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className="flex flex-col gap-2 border-l-2 py-1 pl-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: s.done ? "var(--good)" : "var(--hud-edge)" }}
          >
            <span className={`flex items-center gap-2 text-sm ${s.done ? "text-muted line-through" : ""}`}>
              {s.done ? <Check className="h-4 w-4 shrink-0 text-good" aria-label="Done" /> : <span className="mono w-4 shrink-0 text-xs text-muted">{i + 1}</span>}
              {s.label}
            </span>
            {!s.done && s.action && <span className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{s.action}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
