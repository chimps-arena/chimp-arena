import { levelProgress } from "@/lib/game/xp";

export function XpBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const { level, into, span, pct, nextAt } = levelProgress(xp);
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">Level {level}</span>
        {!compact && (
          <span className="mono text-xs text-muted">
            {xp.toLocaleString()} XP · {Math.max(0, nextAt - xp).toLocaleString()} to
            next
          </span>
        )}
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full border border-border/60 bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, var(--accent-2), var(--accent-3))",
            boxShadow: "0 0 16px -2px color-mix(in srgb, var(--accent-3) 70%, transparent)",
          }}
        />
      </div>
      {!compact && (
        <div className="mono mt-1 text-[11px] text-muted">
          {Math.round(into).toLocaleString()} / {span.toLocaleString()} this level
        </div>
      )}
    </div>
  );
}
