import { Medal } from "lucide-react";
import type { MeResponse } from "@/lib/types";

export function RankCard({ rank }: { rank: MeResponse["rank"] }) {
  return (
    <div className="hud-panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="hud-label">Rank {String(rank.index).padStart(2, "0")}</span>
        <span className="mono text-xs text-muted">
          Lv {rank.level} · {rank.propertiesOwned} owned
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="hud-well">
          <Medal className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="text-xl font-bold uppercase tracking-wide text-[color:var(--hud-amber)]" style={{ fontFamily: "var(--font-hud)" }}>
          {rank.name}
        </div>
      </div>
      <p className="text-xs text-muted">{rank.unlocks}</p>
      {rank.next && (
        <p className="text-xs text-muted">
          Next: <span className="text-foreground">{rank.next.name}</span> at level {rank.next.minLevel} with{" "}
          {rank.next.minProperties} properties owned.
        </p>
      )}
    </div>
  );
}
