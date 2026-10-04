"use client";

import { SolanaProvider } from "@/components/solana-provider";

/**
 * HandleEditor (paid renames) needs @solana/wallet-adapter-react's
 * useWallet() to build and send the $CHIMP payment, same as chimp-mint.tsx
 * under /mint - without this provider in the tree, wallet.publicKey is
 * always null here regardless of whether the player is actually connected
 * (the dashboard's own session login is a separate, direct Phantom
 * connection and doesn't feed this context at all).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SolanaProvider>{children}</SolanaProvider>;
}
