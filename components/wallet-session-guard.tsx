"use client";

import { useCallback, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useSession } from "@/components/session-provider";
import { shortWallet } from "@/lib/format";

/**
 * Thin banner shown when the connected wallet no longer matches the logged-in
 * player (user switched accounts in their wallet). Offers a one-click re-auth
 * to the now-connected wallet, or logout.
 */
export function WalletSessionGuard() {
  const { me, refresh, logout } = useSession();
  const { publicKey, connected, signMessage } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const sessionWallet = me?.player?.wallet ?? null;
  const connectedWallet = connected && publicKey ? publicKey.toBase58() : null;
  const mismatch =
    sessionWallet != null &&
    connectedWallet != null &&
    sessionWallet !== connectedWallet;

  const reauth = useCallback(async () => {
    if (!publicKey || !signMessage || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const address = publicKey.toBase58();
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      if (!nonceRes.ok) throw new Error("Could not start sign-in");
      const { message, challengeToken } = await nonceRes.json();
      const sig = await signMessage(new TextEncoder().encode(message));
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          signature: bs58.encode(sig),
          challengeToken,
        }),
      });
      if (!verifyRes.ok) {
        const { error: msg } = await verifyRes.json().catch(() => ({}));
        throw new Error(msg || "Verification failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-auth failed");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }, [publicKey, signMessage, refresh]);

  if (!mismatch) return null;

  return (
    <div className="border-b border-bad/40 bg-bad/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span>
          Signed in as{" "}
          <span className="mono">{shortWallet(sessionWallet!)}</span> but{" "}
          <span className="mono">{shortWallet(connectedWallet!)}</span> is
          connected.
        </span>
        <button
          onClick={reauth}
          disabled={busy}
          className="btn btn-primary px-3 py-1 text-xs"
        >
          {busy ? "Signing…" : "Switch to connected wallet"}
        </button>
        <button
          onClick={() => logout()}
          className="btn btn-ghost px-3 py-1 text-xs"
        >
          Log out
        </button>
        {error && <span className="text-bad">{error}</span>}
      </div>
    </div>
  );
}
