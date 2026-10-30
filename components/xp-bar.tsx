import { levelProgress } from "@/lib/game/xp";

export function XpBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const { level, into, span, pct, nextAt } = levelProgress(xp);
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="hud-label !text-foreground">
          Level <span className="hud-value text-sm">{String(level).padStart(2, "0")}</span>
        </span>
        {!compact && (
          <span className="mono text-xs text-muted">
            {Math.max(0, nextAt - xp).toLocaleString()} XP to next
          </span>
        )}
      </div>
      <div className="hud-gauge mt-1.5">
        <div className="hud-gauge-fill" style={{ width: `${pct}%` }} />
      </div>
      {!compact && (
        <div className="mono mt-1 flex justify-between text-[11px] text-muted">
          <span>
            {Math.round(into).toLocaleString()} / {span.toLocaleString()}
          </span>
          <span>{xp.toLocaleString()} XP total</span>
        </div>
      )}
    </div>
  );
}
