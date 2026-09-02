"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import bs58 from "bs58";
import { useSession } from "@/components/session-provider";
import { shortWallet } from "@/lib/format";
import {
  getPhantom,
  onPhantomAccountChange,
  phantomAddress,
} from "@/lib/phantom";

/**
 * Banner shown when the Phantom account currently selected differs from the
 * logged-in player (user switched accounts in Phantom). One-click re-auth to
 * the now-selected account, or log out.
 */
export function WalletSessionGuard() {
  const { me, refresh, logout } = useSession();
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    // Initial sync of the injected-provider address into React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectedWallet(phantomAddress());
    const off = onPhantomAccountChange(setConnectedWallet);
    const onFocus = () => setConnectedWallet(phantomAddress());
    window.addEventListener("focus", onFocus);
    return () => {
      off();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const sessionWallet = me?.player?.wallet ?? null;
  const mismatch =
    !!sessionWallet && !!connectedWallet && sessionWallet !== connectedWallet;

  const reauth = useCallback(async () => {
    const p = getPhantom();
    if (!p || !connectedWallet || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: connectedWallet }),
      });
      if (!nonceRes.ok) throw new Error("Could not start sign-in");
      const { message, challengeToken } = await nonceRes.json();
      const { signature } = await p.signMessage(
        new TextEncoder().encode(message),
        "utf8",
      );
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: connectedWallet,
          signature: bs58.encode(signature),
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
  }, [connectedWallet, refresh]);

  if (!mismatch) return null;

  return (
    <div className="border-b border-bad/40 bg-bad/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span>
          Signed in as{" "}
          <span className="mono">{shortWallet(sessionWallet!)}</span> but{" "}
          <span className="mono">{shortWallet(connectedWallet!)}</span> is
          selected in Phantom.
        </span>
        <button
          onClick={reauth}
          disabled={busy}
          className="btn btn-primary px-3 py-1 text-xs"
        >
          {busy ? "Signing…" : "Switch to selected wallet"}
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
