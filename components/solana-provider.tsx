"use client";

import { useCallback, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import type { WalletError } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { chainEndpoint } from "@/lib/chain/connection";
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Wraps the app in Solana wallet context.
 *
 * We list **Phantom only** explicitly. Wallet Standard auto-detection alone
 * proved unreliable here (the picker would show "no wallet" even with Phantom
 * installed), and listing the Solflare adapter too caused a load race. So:
 * Phantom is guaranteed in the picker via its adapter; Solflare / Backpack /
 * others still appear when installed via Wallet Standard; the adapter dedupes
 * Phantom against its own Standard registration by name.
 *
 * `autoConnect` restores the last wallet on reload.
 */
export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => chainEndpoint(), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const onError = useCallback((e: WalletError) => {
    // Adapter errors are otherwise swallowed; surface for debugging.
    console.warn("[wallet]", e.name, e.message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
