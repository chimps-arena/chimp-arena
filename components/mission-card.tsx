import Link from "next/link";
import type { MeResponse } from "@/lib/types";

type MissionStatus = MeResponse["today"]["missions"][number];

const TYPE_ART: Record<string, string> = {
  reaction: "⚡",
  trivia: "🧠",
  "astro-run": "🚀",
  dodge: "☄️",
};

const TYPE_COLOR: Record<string, string> = {
  reaction: "var(--accent)",
  trivia: "var(--accent-2)",
  "astro-run": "var(--accent-3)",
  dodge: "var(--accent-4)",
};

export function MissionCard({ status }: { status: MissionStatus }) {
  const { def, completed, bestScore, xpEarned, higherIsBetter } = status;
  const color = TYPE_COLOR[def.type] ?? "var(--accent-2)";

  return (
    <Link
      href={def.href}
      className="card group flex flex-col gap-3 p-5 transition duration-200 hover:-translate-y-1"
      style={{ borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}
    >
      <div className="flex items-start justify-between">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl text-2xl transition group-hover:scale-110"
          style={{
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
            boxShadow: `0 0 24px -10px ${color}`,
          }}
        >
          {TYPE_ART[def.type] ?? "🎮"}
        </span>
        {completed ? (
          <span className="chip text-good" style={{ borderColor: "color-mix(in srgb, var(--good) 40%, transparent)" }}>
            +{xpEarned} XP today
          </span>
        ) : (
          <span className="chip" style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}>
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
        <span
          className="font-semibold transition group-hover:translate-x-0.5"
          style={{ color }}
        >
          {completed ? "Play again →" : "Start →"}
        </span>
      </div>
    </Link>
  );
}
