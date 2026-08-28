"use client";

import { GameShell } from "@/components/games/game-shell";
import { ReactionGame } from "@/components/games/reaction-game";

export default function ReactionMissionPage() {
  return (
    <GameShell
      slug="reaction"
      title="Reflex Check"
      subtitle="Five rounds. The screen turns green — click as fast as you can."
      instructions={
        <ul className="list-disc space-y-1 pl-5">
          <li>Click the panel to arm each round.</li>
          <li>Wait for green, then click instantly.</li>
          <li>Clicking early fails the round — retry it, no penalty.</li>
          <li>Your score is the average of all 5 reaction times. Lower is better.</li>
        </ul>
      }
      renderGame={(ctx) => <ReactionGame {...ctx} />}
    />
  );
}
