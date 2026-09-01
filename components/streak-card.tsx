import type { MeResponse } from "@/lib/types";
import { STREAK_MILESTONES } from "@/lib/game/economy";

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
          color: "var(--accent)",
        }
      : { text: "Play today to start a streak.", color: "var(--muted)" };

  const toMilestone = nextMilestone ? nextMilestone - count : null;

  return (
    <div
      className="card p-5"
      style={
        atRisk
          ? { borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)" }
          : undefined
      }
    >
      <div className="flex items-center gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl"
          style={{
            background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            boxShadow: count > 1 ? "var(--glow-yellow)" : undefined,
            filter: count === 0 ? "grayscale(1) opacity(0.5)" : undefined,
          }}
        >
          🔥
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{count}</span>
            <span className="text-sm text-muted">
              day{count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mono text-xs text-muted">best {best}</div>
        </div>
      </div>

      <p className="mt-3 text-sm" style={{ color: state.color }}>
        {state.text}
      </p>

      {nextMilestone && toMilestone !== null && (
        <p className="mt-1 text-xs text-muted">
          {toMilestone === 0
            ? `Milestone day — +${STREAK_MILESTONES[nextMilestone] ?? 0} XP on your next run.`
            : `${toMilestone} day${toMilestone === 1 ? "" : "s"} to the ${nextMilestone}-day milestone (+${STREAK_MILESTONES[nextMilestone] ?? 0} XP).`}
        </p>
      )}

      {count > 1 && crewName && (
        <p className="mt-2 text-xs text-muted">
          Every streak day feeds {crewName}&apos;s score.
        </p>
      )}
    </div>
  );
}
