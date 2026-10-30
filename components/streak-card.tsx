import { Flame } from "lucide-react";
import type { MeResponse } from "@/lib/types";
import { STREAK_MILESTONES } from "@/lib/game/economy";
import { Lamp, tint } from "@/components/hud";

export function StreakCard({
  streak,
  crewName,
}: {
  streak: MeResponse["streak"];
  crewName?: string | null;
}) {
  const { count, best, playedToday, atRisk, nextMilestone } = streak;

  const state = playedToday
    ? { text: "Played today. Streak is safe.", color: "var(--good)" }
    : atRisk
      ? {
          text: `Play a mission today to keep your ${count}-day streak.`,
          color: "var(--hud-amber)",
        }
      : { text: "Play today to start a streak.", color: "var(--muted)" };

  const toMilestone = nextMilestone ? nextMilestone - count : null;

  return (
    <div
      className={`hud-panel flex flex-col gap-3 p-5${atRisk ? " hud-panel-hot" : ""}`}
      style={tint("var(--hud-amber)")}
    >
      <div className="flex items-center justify-between">
        <span className="hud-label">Streak</span>
        <span className="mono text-xs text-muted">best {best}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="hud-well" style={count === 0 ? { filter: "grayscale(1) opacity(0.5)" } : undefined}>
          <Flame className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="hud-value text-3xl">
          {String(count).padStart(2, "0")}
          <span className="ml-1.5 text-sm font-normal text-muted">day{count === 1 ? "" : "s"}</span>
        </div>
      </div>

      <p className="flex items-center gap-2 text-sm" style={{ color: state.color }}>
        <Lamp color={state.color} live={atRisk} />
        {state.text}
      </p>

      {nextMilestone && toMilestone !== null && (
        <p className="text-xs text-muted">
          {toMilestone === 0
            ? `Milestone day: +${STREAK_MILESTONES[nextMilestone] ?? 0} XP on your next run.`
            : `${toMilestone} day${toMilestone === 1 ? "" : "s"} to the ${nextMilestone}-day milestone (+${STREAK_MILESTONES[nextMilestone] ?? 0} XP).`}
        </p>
      )}

      {count > 1 && crewName && (
        <p className="text-xs text-muted">Every streak day feeds {crewName}&apos;s score.</p>
      )}
    </div>
  );
}
