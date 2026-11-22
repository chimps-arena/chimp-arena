"use client";

/**
 * What the NPCs say, and the HUD for talking to them: a "Press E to talk"
 * prompt when one is in range, and the conversation panel (intro line plus
 * topics to ask about). Some answers read live game data - the scoreboard,
 * who's online - so they're functions of a small context.
 *
 * Copy rule: this repo is public, so lines describe the game in general terms
 * only - no fee splits or tokenomics.
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { characterById, HEADSHOT_DAMAGE, RESPAWN_MS, SHOT_DAMAGE, SHOT_RANGE } from "@chimp-arena/shared";
import { endTalk, npcSpec, npcTalkStore, toggleTalk } from "./npcs";
import { NewsReader, type NewsIndex } from "./news";
import { PropertyPanel } from "./property-panel";
import { TravelPanel } from "./starports";

export interface NpcContext {
  players: { name: string; kills: number; deaths: number }[];
  online: number;
  propertyCount: number;
  magSize: number;
  /** Ask the server to fly me to a starport. */
  travel: (to: string) => void;
}

interface Topic {
  q: string;
  a: (c: NpcContext) => ReactNode;
}

interface Script {
  intro: string;
  topics: Topic[];
}

function Leaderboard({ c, n, empty }: { c: NpcContext; n: number; empty: string }) {
  const top = [...c.players].filter((p) => p.kills > 0).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).slice(0, n);
  if (top.length === 0) return <p>{empty}</p>;
  return (
    <ol className="mt-1 space-y-1">
      {top.map((p, i) => (
        <li key={`${p.name}-${i}`} className="flex justify-between gap-6 rounded bg-white/5 px-2 py-1">
          <span>
            <span className="mr-2 text-amber-300">#{i + 1}</span>
            {p.name}
          </span>
          <span className="tabular-nums text-white/70">
            {p.kills} kills · {p.deaths} deaths
          </span>
        </li>
      ))}
    </ol>
  );
}

const SCRIPTS: Record<string, Script> = {
  "std-astrogaurd-safu-security": {
    intro: "Halt. Oh, it's you. Astrocorp Security. Inside this wall is the Core: no weapons, no fights, no exceptions.",
    topics: [
      {
        q: "Why can't I shoot in here?",
        a: () => "The Core is the safe zone. Rifles stay holstered from the wall inward, and shots fired in from outside don't land. Step through a gate and you're fair game.",
      },
      {
        q: "Where do these roads go?",
        a: () => (
          <>
            Three gates, three districts:
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <b className="text-orange-400">The Belt</b>: mining claims, quarries, foundries.
              </li>
              <li>
                <b className="text-slate-300">Lunar Rim</b>: domes, greenhouses, observatories.
              </li>
              <li>
                <b className="text-amber-300">Helios Docks</b>: docks, hangars, fuel lots.
              </li>
            </ul>
            The minimap in the corner shows the way.
          </>
        ),
      },
      {
        q: "What if I go down out there?",
        a: () =>
          `You're back on your feet in ${RESPAWN_MS / 1000} seconds at a safe spot. When item loadouts arrive, anything you carry can be taken by whoever dropped you, so travel light.`,
      },
    ],
  },
  "std-castro": {
    intro: "Castro, Astromilitary. I keep this plaza in order. Make it quick.",
    topics: [
      {
        q: "What's that tower?",
        a: () =>
          "Astrocorp HQ. Around it is the Resource Exchange: every raw ore beside its refined form. The Charged Crystal out front is a Void Crystal and a Charge Kit, fused.",
      },
      {
        q: "How do I get a rover?",
        a: () => "Press F anywhere for a free test rover. The luxury models in the showroom are coming as NFTs you'll own outright.",
      },
      {
        q: "Who's leading today?",
        a: (c) => <Leaderboard c={c} n={5} empty="Quiet day. Nobody has a kill yet." />,
      },
    ],
  },
  "std-death": {
    intro: "You found me. Most don't, until it's too late.",
    topics: [
      {
        q: "Who's worth hunting?",
        a: (c) => (
          <>
            <p className="mb-1">The most wanted right now:</p>
            <Leaderboard c={c} n={3} empty="Nobody has earned a name yet. Go make one." />
          </>
        ),
      },
      {
        q: "How do I get better?",
        a: () => (
          <ul className="list-disc space-y-0.5 pl-5">
            <li>
              Aim for the head: {HEADSHOT_DAMAGE} damage against {SHOT_DAMAGE} to the body.
            </li>
            <li>Right click to aim down sights for the long shots.</li>
            <li>C to crouch behind cover. R to reload before you need to.</li>
            <li>Never fight in the open if a wall is close.</li>
          </ul>
        ),
      },
      { q: "Are you coming after me?", a: () => "Not today. Today you're not worth the walk." },
    ],
  },
  "std-weapon-specialist-ryan": {
    intro: "Weapon Specialist Ryan. If it fires, I've tuned it.",
    topics: [
      {
        q: "What am I carrying?",
        a: (c) => (
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Astral rifle, {c.magSize}-round magazine</li>
            <li>
              {SHOT_DAMAGE} damage to the body, {HEADSHOT_DAMAGE} to the head
            </li>
            <li>Effective out to {SHOT_RANGE} metres</li>
            <li>R reloads. It only comes out in the combat zones.</li>
          </ul>
        ),
      },
      {
        q: "Can I buy weapons here?",
        a: () =>
          "Soon. Armories will stock weapons designed by creators, sold as NFT items: minted to your wallet, yours to keep or resell. Load one into your inventory to use it, and guard it, because it can be taken if you fall.",
      },
      { q: "Any advice?", a: () => "Short bursts. Every miss tells them where you are, so make each shot count." },
    ],
  },
  "std-undercover-dave": {
    intro: "Name's Dave. I work the foundry. Don't ask about the 'undercover' part.",
    topics: [
      {
        q: "What does a foundry do?",
        a: () => "Raw ore comes in (Gold, Cobalt, Palladium, Void Crystal) and leaves as refined bars and cut crystal. You can see each pair on the pedestals at the Exchange.",
      },
      {
        q: "Where does the ore come from?",
        a: () =>
          "It'll be mined out in the districts, then routed through player-owned properties (shipping, a foundry like this one, a vault) before it comes out refined. Mining is on its way.",
      },
      { q: "What's a Charged Crystal?", a: () => "One Void Crystal plus one Charge Kit. There's one glowing in front of HQ if you want a look." },
    ],
  },
  "std-drink-mixer": {
    intro: "Welcome to Astroburger! Best burgers this side of the Belt, and the only shakes that stay put in zero-G.",
    topics: [
      { q: "What's good today?", a: () => "The Astro Burger, always. Neon Fries if you need the energy, and a Zero-G Banana Shake to wash it down. The Power Bar is for people in a hurry." },
      {
        q: "Can I order?",
        a: () => "Not yet. The kitchen opens with the item shop: food and drink as items you own, made from real Astrofoods kits. For now, take a look at the menu out front.",
      },
      { q: "Heard any news?", a: () => "Read Astro-News at the stand by the Rover Showroom. Sector 7 is crawling with Astrocorp security, and nobody's seen Kill Boy Tommy in days." },
    ],
  },
  "std-techno-left-the-building": {
    intro: "Techno, comms. Every signal in Astroworld bounces off a tower like this one.",
    topics: [
      {
        q: "What's happening right now?",
        a: (c) => (
          <>
            <p>
              {c.online} chimp{c.online === 1 ? "" : "s"} online, {c.propertyCount} properties across the Core and three districts.
            </p>
            {c.players.length > 0 && <p className="mt-1 text-white/70">On the network: {c.players.slice(0, 10).map((p) => p.name).join(", ")}{c.players.length > 10 ? "…" : ""}</p>}
          </>
        ),
      },
      { q: "How do I talk to people?", a: () => "Enter or T opens chat. Your line floats over your head for everyone nearby. Keep it clean; the filter is stricter than I am." },
      { q: "How do I find a property?", a: () => "Every lot has its name on a sign and its NFT art out front. The minimap shows the districts, and owners or prices show up as you get close." },
    ],
  },
};

const FALLBACK: Script = { intro: "…", topics: [] };

/** "Press E to talk" when an NPC is in range; the conversation panel when talking. */
export function NpcHud({ context, touch, news }: { context: NpcContext; touch: boolean; news: NewsIndex | null }) {
  const st = useSyncExternalStore(npcTalkStore.subscribe, npcTalkStore.get, npcTalkStore.get);
  if (st.talking) {
    const using = npcSpec(st.talking);
    if (using?.kind === "news") return news ? <NewsReader news={news} /> : null;
    if (using?.kind === "property" && using.property) return <PropertyPanel key={st.talking} property={using.property} />;
    if (using?.kind === "port") return <TravelPanel key={st.talking} portKey={st.talking} onTravel={context.travel} />;
    return <Conversation key={st.talking} npcKey={st.talking} context={context} />;
  }
  const near = npcSpec(st.near);
  if (!near) return null;
  const name = near.title ?? characterById(near.characterId).name;
  const verb = near.kind === "news" ? "Read" : near.kind === "property" ? "Visit" : near.kind === "port" ? "Board" : "Talk to";
  return (
    <div className="absolute inset-x-0 top-[36%] z-30 flex justify-center">
      {touch ? (
        <button type="button" onClick={() => toggleTalk()} className="rounded-full border border-amber-400/70 bg-black/75 px-4 py-2 text-sm font-bold text-amber-300">
          {verb} {name}
        </button>
      ) : (
        <div className="pointer-events-none rounded-full border border-amber-400/60 bg-black/70 px-4 py-1.5 text-sm text-white">
          <kbd className="mr-2 rounded bg-amber-400 px-1.5 py-0.5 text-xs font-black text-black">E</kbd>
          {verb} <b className="text-amber-300">{name}</b>
        </div>
      )}
    </div>
  );
}

function Conversation({ npcKey, context }: { npcKey: string; context: NpcContext }) {
  const spec = npcSpec(npcKey);
  const look = characterById(spec?.characterId);
  const script = (spec && SCRIPTS[spec.characterId]) || FALLBACK;
  const [topic, setTopic] = useState<number | null>(null);

  // Free the mouse so the topics can be clicked; Esc closes.
  useEffect(() => {
    document.exitPointerLock?.();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTalk();
      const n = Number(e.key);
      if (n >= 1 && n <= script.topics.length) setTopic(n - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [script.topics.length]);

  const asked = topic !== null ? script.topics[topic] : null;
  return (
    <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-3">
      <div className="w-full max-w-xl rounded-xl border border-amber-400/50 bg-black/85 p-4 text-white shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={look.image} alt="" className="h-14 w-14 rounded-lg border border-white/20 object-cover" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{look.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-amber-300">{spec?.role ?? "NPC"}</div>
          </div>
          <button type="button" onClick={endTalk} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20" aria-label="Close">
            Close <span className="text-white/50">(Esc)</span>
          </button>
        </div>
        <div className="mt-3 min-h-[3rem] rounded-lg bg-white/5 p-3 text-sm leading-relaxed">
          {asked ? (
            <>
              <div className="mb-1 text-xs text-white/50">You: {asked.q}</div>
              {asked.a(context)}
            </>
          ) : (
            script.intro
          )}
        </div>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {script.topics.map((t, i) => (
            <button
              key={t.q}
              type="button"
              onClick={() => setTopic(i)}
              className={`rounded-lg border px-3 py-1.5 text-left text-sm ${topic === i ? "border-amber-400 bg-amber-400/15" : "border-white/15 hover:bg-white/10"}`}
            >
              <span className="mr-1.5 text-white/40">{i + 1}.</span>
              {t.q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
