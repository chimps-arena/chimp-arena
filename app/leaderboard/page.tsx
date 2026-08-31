"use client";

import { useSession } from "@/components/session-provider";
import { LeaderboardTables } from "@/components/leaderboard-tables";

export default function LeaderboardPage() {
  const { me } = useSession();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Leaderboards</h1>
        <p className="mt-1 text-muted">
          Crew standings are the whole game. Individual XP is the fuel.
        </p>
      </div>
      <LeaderboardTables
        initial={null}
        highlightWallet={me?.player?.wallet ?? null}
      />
    </div>
  );
}
