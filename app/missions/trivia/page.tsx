"use client";

import { GameShell } from "@/components/games/game-shell";
import { TriviaGame } from "@/components/games/trivia-game";

export default function TriviaMissionPage() {
  return (
    <GameShell
      slug="trivia"
      title="Jungle Intel"
      subtitle="Five questions on Solana, crypto and $CHIMP lore. 15 seconds each."
      instructions={
        <ul className="list-disc space-y-1 pl-5">
          <li>Five multiple-choice questions, drawn fresh each day.</li>
          <li>15 seconds per question — no answer counts as wrong.</li>
          <li>Answers lock the moment you tap them.</li>
          <li>XP scales with how many you get right.</li>
        </ul>
      }
      renderGame={(ctx) => <TriviaGame {...ctx} />}
    />
  );
}
