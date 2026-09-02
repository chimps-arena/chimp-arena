"use client";

import bs58 from "bs58";

/** Minimal shape of the Phantom injected provider we rely on. */
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

export const PHANTOM_INSTALL_URL = "https://phantom.com/download";

export function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  const p = w.phantom?.solana ?? w.solana;
  return p?.isPhantom ? p : null;
}

export function phantomInstalled(): boolean {
  try {
    return getPhantom() !== null;
  } catch {
    return false;
  }
}

/** Currently-connected Phantom address, or null. */
export function phantomAddress(): string | null {
  try {
    return getPhantom()?.publicKey?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Prompt Phantom to connect. Returns the base58 address. */
export async function connectPhantom(
  opts: { onlyIfTrusted?: boolean } = {},
): Promise<string> {
  const p = getPhantom();
  if (!p) throw new Error("Phantom not detected. Install it, then reload.");
  const { publicKey } = await p.connect(opts);
  return publicKey.toString();
}

export async function disconnectPhantom(): Promise<void> {
  try {
    await getPhantom()?.disconnect();
  } catch {
    /* already disconnected */
  }
}

/** Sign a utf-8 string, return a base58 signature. */
export async function phantomSignMessage(message: string): Promise<string> {
  const p = getPhantom();
  if (!p) throw new Error("Phantom not detected");
  const { signature } = await p.signMessage(
    new TextEncoder().encode(message),
    "utf8",
  );
  return bs58.encode(signature);
}

/** Subscribe to account switches. Returns an unsubscribe fn. */
export function onPhantomAccountChange(cb: (address: string | null) => void): () => void {
  const p = getPhantom();
  if (!p) return () => {};
  const handler = (arg: unknown) => {
    const pk = arg as { toString(): string } | null;
    cb(pk ? pk.toString() : null);
  };
  p.on("accountChanged", handler);
  return () => p.removeListener("accountChanged", handler);
}
