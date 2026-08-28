"use client";

import { GameShell } from "@/components/games/game-shell";
import { DebrisField } from "@/components/games/debris-field";

export default function DebrisFieldMissionPage() {
  return (
    <GameShell
      slug="debris-field"
      title="Debris Field"
      subtitle="Steer your pod side to side through an asteroid belt. Survive as long as you can."
      instructions={
        <ul className="list-disc space-y-1 pl-5">
          <li>Steer with ← / → , A / D, or drag your finger / mouse across the field.</li>
          <li>Any rock that touches your pod ends the run.</li>
          <li>The belt scrolls faster the longer you last.</li>
          <li>Your score is the distance you survive. Higher is better.</li>
        </ul>
      }
      renderGame={(ctx) => <DebrisField {...ctx} />}
    />
  );
}
