"use client";

import { useSession } from "@/components/session-provider";
import { LeaderboardTables } from "@/components/leaderboard-tables";
import { PageHeader } from "@/components/hud";

export default function LeaderboardPage() {
  const { me } = useSession();
  const isGuest = me?.player?.wallet.startsWith("guest_") ?? false;
  return (
    <div className="hud flex flex-col gap-6">
      <PageHeader
        kicker="Sector standings · live feed"
        title="Leaderboards"
        blurb={
          isGuest
            ? "Crew standings are the whole game. Only wallet players rank - connect yours to get on the board."
            : "Crew standings are the whole game. Individual XP is the fuel."
        }
      />
      <LeaderboardTables
        initial={null}
        highlightWallet={me?.player?.wallet ?? null}
      />
    </div>
  );
}
