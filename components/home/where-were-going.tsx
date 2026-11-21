"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Lamp, SectionHeader, tint } from "@/components/hud";
import { Reveal } from "@/components/reveal";

/**
 * "What we're building and where it's going" for the homepage (devlog #10).
 *
 * Copy rules: "Live" means a visitor can use it today; "Building" means
 * code exists and is in progress; "Next" is the agreed design with no date
 * promised. No earnings promises anywhere (see /legal and TOKEN-POLICY.md).
 * Keep this in step with the whitepaper roadmap.
 */

type Stage = "Live" | "Building" | "Next";

const STAGE_COLOR: Record<Stage, string> = {
  Live: "var(--good)",
  Building: "var(--hud-cyan)",
  Next: "var(--accent-violet)",
};

const ROADMAP: { stage: Stage; title: string; items: { name: string; blurb: string; href?: string }[] }[] = [
  {
    stage: "Live",
    title: "Play today",
    items: [
      { name: "$CHIMP on Solana", blurb: "Fixed supply, liquidity locked for good.", href: "/whitepaper" },
      { name: "Daily missions + crews", blurb: "Mini-games for XP that lift your crew up the board.", href: "/missions" },
      { name: "Astrochimp NFTs", blurb: "47 characters across Common, Rare and One of One.", href: "/mint" },
      { name: "Property NFTs", blurb: "Own a plot in the Belt, the Core and beyond.", href: "/market" },
    ],
  },
  {
    stage: "Building",
    title: "In the works now",
    items: [
      { name: "Astroworld", blurb: "A live multiplayer 3D world. Walk it as your Astrochimp, with other players, in real time." },
      { name: "Your property, in 3D", blurb: "The plots you own stand in Astroworld where everyone can see them." },
      { name: "Mining", blurb: "Dig for Gold, Palladium, Cobalt and Void Crystal in the world." },
    ],
  },
  {
    stage: "Next",
    title: "Where we're headed",
    items: [
      { name: "Player-run economy", blurb: "Properties that do real work: shops, foundries, docks and greenhouses run by their owners." },
      { name: "Creator items", blurb: "Creators design gear, food and weapons as NFTs, sold in player-owned stores." },
      { name: "Rovers and spaceships", blurb: "Drive the Core in a luxury rover. Spaceships are the top of the status ladder." },
      { name: "Community treasury", blurb: "Holders vote on how the treasury is spent. Founder wallets can't vote." },
    ],
  },
];

export function WhereWereGoing() {
  return (
    <section className="flex flex-col gap-6">
      <Reveal>
        <SectionHeader title="Where we're going" aside="live · building · next" />
        <p className="mt-3 max-w-prose text-muted">
          Astrochimpz is growing from daily mini-games into a player-owned space
          world on Solana. Here&apos;s what you can play now, what we&apos;re
          building, and what comes after.
        </p>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-3">
        {ROADMAP.map((col, i) => {
          const color = STAGE_COLOR[col.stage];
          return (
            <Reveal key={col.stage} delay={i * 0.08}>
              <div className="hud-panel flex h-full flex-col gap-4 p-5" style={tint(color)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="hud-label flex items-center gap-2" style={{ color }}>
                    <Lamp color={color} live={col.stage !== "Next"} /> {col.stage}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-muted">{col.title}</span>
                </div>
                <ul className="flex flex-col gap-3">
                  {col.items.map((it) => (
                    <li key={it.name} className="border-l-2 pl-3" style={{ borderColor: color }}>
                      {it.href ? (
                        <Link href={it.href} className="font-bold uppercase tracking-wider hover:underline">
                          {it.name}
                        </Link>
                      ) : (
                        <div className="font-bold uppercase tracking-wider">{it.name}</div>
                      )}
                      <p className="mt-0.5 text-sm text-muted">{it.blurb}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal>
        <LaunchSignup />
      </Reveal>
    </section>
  );
}

function LaunchSignup() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot - see app/api/signup
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't sign you up. Please try again.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign you up. Please try again.");
      setState("error");
    }
  }

  return (
    <div
      className="hud-panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
      style={tint("var(--accent-3)")}
    >
      <div className="min-w-0">
        <div className="font-bold uppercase tracking-wider">Be there when Astroworld opens</div>
        <p className="mt-1 text-sm text-muted">
          Launch news and new drops only. No spam, and you can ask us to remove
          you anytime (<Link href="/legal#privacy" className="underline">privacy</Link>).
        </p>
      </div>

      {state === "done" ? (
        <p className="hud-label flex items-center gap-2 !text-foreground" role="status">
          <Lamp color="var(--good)" /> You&apos;re on the list.
        </p>
      ) : (
        <form onSubmit={submit} className="flex w-full flex-col gap-2 md:w-auto">
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <label htmlFor="launch-email" className="sr-only">
              Email address
            </label>
            <input
              id="launch-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="hud-well min-w-0 flex-1 px-3 py-2 text-sm md:w-64"
            />
            {/* honeypot: hidden from people and screen readers, bots fill it */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            <button type="submit" disabled={state === "sending"} className="hud-btn !py-2 !text-[0.7rem]">
              {state === "sending" ? "Signing up…" : "Notify me ▸"}
            </button>
          </div>
          {state === "error" && (
            <p className="text-xs text-[color:var(--bad,#f87171)]" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
