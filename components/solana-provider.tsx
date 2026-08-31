"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { chainEndpoint } from "@/lib/chain/connection";
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Wraps the app in Solana wallet context.
 *
 * Wallet Standard wallets (Backpack, etc.) auto-register when installed. We
 * ALSO list Phantom + Solflare explicitly so the connect modal shows them
 * even on a machine with no wallet — clicking one then routes to its install
 * page instead of dead-ending on "You'll need a wallet on Solana". The
 * adapter dedupes these against their Standard registration by name.
 *
 * `autoConnect` restores the last wallet on reload.
 */
export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => chainEndpoint(), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
