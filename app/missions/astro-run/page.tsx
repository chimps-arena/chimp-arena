"use client";

import { GameShell } from "@/components/games/game-shell";
import { AstroRun } from "@/components/games/astro-run";

export default function AstroRunMissionPage() {
  return (
    <GameShell
      slug="astro-run"
      title="Astro Run"
      subtitle="Endless runner. Dodge the debris, ride the speed ramp, bank distance."
      instructions={
        <ul className="list-disc space-y-1 pl-5">
          <li>Press Space / ↑ / tap the canvas to jump.</li>
          <li>Purple rocks and red debris end your run on contact.</li>
          <li>Speed ramps up the longer you survive.</li>
          <li>Your score is the distance you bank. Higher is better.</li>
        </ul>
      }
      renderGame={(ctx) => <AstroRun {...ctx} />}
    />
  );
}
