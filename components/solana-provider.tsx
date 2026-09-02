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
 * others still appear when installed via Wallet Standard.
 *
 * `autoConnect` is OFF on purpose. Silent reconnect on every load raced the
 * sign-in flow and could bind the wrong "Phantom" entry (legacy vs Standard),
 * leaving `signMessage` unavailable. The session is a 30-day cookie, so the
 * wallet only needs connecting at actual sign-in time — an explicit click.
 */
export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => chainEndpoint(), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const onError = useCallback((e: WalletError) => {
    console.warn("[wallet]", e.name, e.message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
