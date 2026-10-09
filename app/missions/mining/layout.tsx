"use client";

import { SolanaProvider } from "@/components/solana-provider";

/**
 * Mining needs useWallet() to pay for permits/tools, same reason
 * app/dashboard/layout.tsx wraps the dashboard for paid renames - mission
 * pages don't have this by default.
 */
export default function MiningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SolanaProvider>{children}</SolanaProvider>;
}
