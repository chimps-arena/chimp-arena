"use client";

import { useCallback, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import type { WalletError } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { chainEndpoint } from "@/lib/chain/connection";
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Wraps the app in Solana wallet context.
 *
 * `wallets={[]}` on purpose: Phantom, Solflare, Backpack and every other
 * Wallet Standard wallet register themselves. Listing legacy adapters here as
 * well caused a detection race (one wallet wouldn't initialise until another
 * had been opened). The "no wallet installed" case is handled in
 * `WalletConnect`, not by the adapter modal.
 *
 * `autoConnect` restores the last wallet on reload.
 */
export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => chainEndpoint(), []);
  const onError = useCallback((e: WalletError) => {
    // Adapter errors are otherwise swallowed; surface for debugging.
    console.warn("[wallet]", e.name, e.message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
