"use client";

import { SolanaProvider } from "@/components/solana-provider";

export default function RepairLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SolanaProvider>{children}</SolanaProvider>;
}
