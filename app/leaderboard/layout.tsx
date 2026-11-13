import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Top Astrochimpz pilots and crews by XP. Run daily missions on Solana and climb the board.",
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
