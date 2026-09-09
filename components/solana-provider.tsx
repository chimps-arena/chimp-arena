"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { chainEndpoint } from "@/lib/chain/connection";
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Wallet-adapter context. Scoped to routes that build/sign real transactions
 * (currently just /mint) — the rest of the app authenticates with a direct
 * Phantom signMessage and doesn't need this. Phantom listed explicitly;
 * Solflare/Backpack still appear via Wallet Standard when installed.
 */
export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => chainEndpoint(), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
