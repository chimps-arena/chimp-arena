import type { Metadata } from "next";
import { AstroworldClient } from "./astroworld-client";

export const metadata: Metadata = {
  title: "Astroworld Core (test)",
  description: "Live multiplayer test of the Astroworld Core safe zone.",
  robots: { index: false, follow: false },
};

export default function AstroworldPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4">
      <AstroworldClient />
    </div>
  );
}
