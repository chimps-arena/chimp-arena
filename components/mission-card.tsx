import Link from "next/link";
import type { MeResponse } from "@/lib/types";

type MissionStatus = MeResponse["today"]["missions"][number];

const TYPE_ART: Record<string, string> = {
  reaction: "⚡",
  trivia: "🧠",
  "astro-run": "🚀",
  dodge: "☄️",
};

export function MissionCard({ status }: { status: MissionStatus }) {
  const { def, completed, bestScore, xpEarned, higherIsBetter } = status;
  return (
    <Link
      href={def.href}
      className="card group flex flex-col gap-3 p-5 transition hover:border-accent/50"
    >
      <div className="flex items-start justify-between">
        <span className="text-3xl">{TYPE_ART[def.type] ?? "🎮"}</span>
        {completed ? (
          <span className="rounded-full bg-good/15 px-2.5 py-1 text-xs font-semibold text-good">
            +{xpEarned} XP today
          </span>
        ) : (
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
            up to +{def.baseXp}+ XP
          </span>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold">{def.title}</h3>
        <p className="mt-1 text-sm text-muted">{def.blurb}</p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-2 text-sm">
        <span className="mono text-xs text-muted">
          {completed && bestScore != null
            ? `Best today: ${bestScore}${def.type === "reaction" ? "ms" : ""}`
            : higherIsBetter
              ? "Higher score is better"
              : "Faster is better"}
        </span>
        <span className="font-semibold text-accent group-hover:underline">
          {completed ? "Play again →" : "Start →"}
        </span>
      </div>
    </Link>
  );
}
