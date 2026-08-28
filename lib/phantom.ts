"use client";

import bs58 from "bs58";

/**
 * Minimal Phantom provider surface we rely on.
 * https://docs.phantom.com/solana/integrating-phantom
 */
interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  isConnected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toString(): string };
  }>;
  disconnect: () => Promise<void>;
  signMessage: (
    message: Uint8Array,
    display?: "utf8" | "hex",
  ) => Promise<{ signature: Uint8Array }>;
  on: (event: string, handler: (args: unknown) => void) => void;
  removeListener: (event: string, handler: (args: unknown) => void) => void;
}

export function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  const provider = w.phantom?.solana ?? w.solana;
  return provider?.isPhantom ? provider : null;
}

export const PHANTOM_INSTALL_URL = "https://phantom.com/download";

export interface ConnectedWallet {
  address: string;
  /** signs a utf-8 string, returns base58 signature */
  signMessage: (message: string) => Promise<string>;
  disconnect: () => Promise<void>;
}

export async function connectPhantom(
  opts: { onlyIfTrusted?: boolean } = {},
): Promise<ConnectedWallet | null> {
  const provider = getPhantom();
  if (!provider) return null;

  const { publicKey } = await provider.connect(opts);
  const address = publicKey.toString();

  return {
    address,
    signMessage: async (message: string) => {
      const encoded = new TextEncoder().encode(message);
      const { signature } = await provider.signMessage(encoded, "utf8");
      return bs58.encode(signature);
    },
    disconnect: () => provider.disconnect(),
  };
}
