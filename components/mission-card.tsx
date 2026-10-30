import Link from "next/link";
import { MissionGlyph } from "@/components/glyphs";
import { Lamp, tint } from "@/components/hud";
import type { MeResponse } from "@/lib/types";

type MissionStatus = MeResponse["today"]["missions"][number];

const TYPE_COLOR: Record<string, string> = {
  reaction: "var(--hud-amber)",
  trivia: "var(--hud-cyan)",
  "astro-run": "var(--accent-3)",
  dodge: "var(--accent-4)",
  mining: "var(--accent-violet)",
};

export function MissionCard({ status, index }: { status: MissionStatus; index: number }) {
  const { def, completed, bestScore, xpEarned, higherIsBetter } = status;
  const color = TYPE_COLOR[def.type] ?? "var(--hud-cyan)";

  if (def.comingSoon) {
    return (
      <div className="hud-panel flex flex-col gap-4 p-5 opacity-70" style={tint("var(--muted)")}>
        <div className="flex items-center justify-between">
          <span className="hud-tag">MSN-{String(index + 1).padStart(2, "0")}</span>
          <span className="hud-label flex items-center gap-1.5">
            <Lamp color="var(--muted)" /> Offline
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="hud-well">
            <MissionGlyph type={def.type} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold uppercase leading-tight">{def.title}</h3>
            <p className="mt-1 text-sm text-muted">{def.blurb}</p>
          </div>
        </div>
        <div className="mt-auto border-t pt-3" style={{ borderColor: "var(--hud-edge)" }}>
          <span className="hud-label !text-[0.72rem] !text-[color:var(--hud-amber)]">Coming soon</span>
        </div>
      </div>
    );
  }

  return (
    <Link href={def.href} className="hud-panel group flex flex-col gap-4 p-5" style={tint(color)}>
      <div className="flex items-center justify-between">
        <span className="hud-tag">
          MSN-{String(index + 1).padStart(2, "0")}
        </span>
        <span className="hud-label flex items-center gap-1.5">
          <Lamp color={completed ? "var(--good)" : "var(--hud-amber)"} live={!completed} />
          {completed ? "Cleared" : "Ready"}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <span className="hud-well">
          <MissionGlyph type={def.type} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold uppercase leading-tight">{def.title}</h3>
          <p className="mt-1 text-sm text-muted">{def.blurb}</p>
        </div>
      </div>

      <div
        className="mt-auto flex items-end justify-between border-t pt-3"
        style={{ borderColor: "var(--hud-edge)" }}
      >
        <div>
          <div className="hud-label">{completed ? "Earned today" : "Reward"}</div>
          <div className="hud-value text-sm" style={{ color: completed ? "var(--good)" : color }}>
            {completed ? `+${xpEarned}` : `${def.baseXp}+`} XP
          </div>
          <div className="mono mt-0.5 text-[11px] text-muted">
            {completed && bestScore != null
              ? `best ${bestScore}${def.type === "reaction" ? "ms" : def.type === "mining" ? " m" : ""}`
              : higherIsBetter
                ? "higher is better"
                : "faster is better"}
          </div>
        </div>
        <span
          className="hud-label !text-[0.72rem] transition group-hover:translate-x-0.5"
          style={{ color }}
        >
          {completed ? "Replay ▸" : "Launch ▸"}
        </span>
      </div>
    </Link>
  );
}
