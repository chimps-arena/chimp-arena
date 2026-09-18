import type { MeResponse } from "@/lib/types";

export function RankCard({ rank }: { rank: MeResponse["rank"] }) {
  return (
    <div className="card flex flex-col gap-2 p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-[0.14em] text-muted">
          Rank {rank.index}
        </div>
        <div className="mono text-xs text-muted">
          Lv {rank.level} · {rank.propertiesOwned} owned
        </div>
      </div>
      <div className="text-xl font-bold text-accent">{rank.name}</div>
      <p className="text-xs text-muted">{rank.unlocks}</p>
      {rank.next && (
        <p className="mt-1 text-xs text-muted">
          Next — <span className="text-foreground">{rank.next.name}</span> at
          level {rank.next.minLevel} with {rank.next.minProperties} properties
          owned.
        </p>
      )}
    </div>
  );
}
