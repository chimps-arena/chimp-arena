"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useSession } from "@/components/session-provider";

type Status = "idle" | "signing" | "verifying" | "error";

/**
 * Connect a Solana wallet, then run the sign-in-with-signature challenge
 * against /api/auth/*. The wallet address is the identity; signing is gasless.
 *
 * Deliberately click-first: connecting and signing are always reachable from
 * the button so a suppressed auto-prompt can never dead-end the user. A single
 * best-effort auto sign-in runs when a wallet connects, and re-arms on
 * disconnect / address change.
 */
export function WalletConnect({
  redirectTo,
  className = "",
  label = "Connect Wallet",
}: {
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const { refresh, me } = useSession();
  const router = useRouter();
  const { publicKey, connected, connecting, signMessage, disconnect } =
    useWallet();
  const { setVisible } = useWalletModal();

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const autoTriedFor = useRef<string | null>(null);

  const address = publicKey?.toBase58() ?? null;
  const signedIn = !!address && me?.player?.wallet === address;

  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage || inFlight.current) return;
    const addr = publicKey.toBase58();
    if (me?.player?.wallet === addr) return;

    inFlight.current = true;
    setError(null);
    try {
      setStatus("verifying");
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: addr }),
      });
      if (!nonceRes.ok) throw new Error("Could not start sign-in");
      const { message, challengeToken } = await nonceRes.json();

      setStatus("signing");
      const sig = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(sig);

      setStatus("verifying");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: addr, signature, challengeToken }),
      });
      if (!verifyRes.ok) {
        const { error: msg } = await verifyRes.json().catch(() => ({}));
        throw new Error(msg || "Verification failed");
      }

      await refresh();
      const nextParam = new URLSearchParams(window.location.search).get("next");
      router.push(redirectTo ?? nextParam ?? "/dashboard");
      router.refresh();
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      const msg =
        e instanceof Error ? e.message : "Something went wrong signing in";
      // A user-rejected signature isn't an error worth shouting about.
      setError(/reject|denied|cancel/i.test(msg) ? null : msg);
      if (/reject|denied|cancel/i.test(msg)) setStatus("idle");
    } finally {
      inFlight.current = false;
    }
  }, [publicKey, signMessage, me, refresh, redirectTo, router]);

  // Re-arm the one-shot auto sign-in whenever the connected address changes
  // (including going back to null on disconnect).
  useEffect(() => {
    if (autoTriedFor.current && autoTriedFor.current !== address) {
      autoTriedFor.current = null;
    }
  }, [address]);

  // Best-effort auto sign-in once per address, only once signMessage is ready.
  useEffect(() => {
    if (!connected || !address || !signMessage || signedIn) return;
    if (autoTriedFor.current === address) return;
    autoTriedFor.current = address;
    void authenticate();
  }, [connected, address, signMessage, signedIn, authenticate]);

  const busy = connecting || status === "signing" || status === "verifying";
  const needsSignIn = connected && !!address && !signedIn;
  const brokenAdapter = connected && !!address && !signMessage;

  const text = connecting
    ? "Connecting…"
    : status === "signing"
      ? "Approve in your wallet…"
      : status === "verifying"
        ? "Verifying…"
        : brokenAdapter
          ? "Reconnect wallet"
          : needsSignIn
            ? "Sign in with wallet"
            : label;

  const onClick = () => {
    setError(null);
    if (brokenAdapter) {
      void disconnect().finally(() => setVisible(true));
    } else if (needsSignIn) {
      void authenticate();
    } else if (connected) {
      void authenticate();
    } else {
      setVisible(true);
    }
  };

  return (
    <div className={className}>
      <button
        className="btn btn-primary w-full sm:w-auto"
        disabled={busy}
        onClick={onClick}
      >
        {busy && <Spinner />}
        {text}
      </button>
      {needsSignIn && !busy && !error && (
        <p className="mt-2 text-xs text-muted">
          Wallet connected. One signature to sign in — free, no transaction.
        </p>
      )}
      {!connected && !busy && (
        <p className="mt-2 text-xs text-muted">
          No wallet?{" "}
          <a
            href="https://phantom.com/download"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Get Phantom
          </a>
          , then reload.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
