"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import bs58 from "bs58";
import { useSession } from "@/components/session-provider";

type Status = "idle" | "connecting" | "signing" | "verifying" | "error";

/**
 * Connect Phantom directly through the adapter (no modal — it was swallowing
 * clicks), then run the sign-in-with-signature challenge against /api/auth/*.
 * The session is a 30-day cookie; the wallet is only needed here at sign-in.
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
  const { publicKey, connected, wallet, select, connect, signMessage, disconnect } =
    useWallet();

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const pendingConnect = useRef(false);
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
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      if (/reject|denied|cancel/i.test(msg)) {
        setStatus("idle");
        setError(null);
      } else {
        setStatus("error");
        setError(msg);
      }
    } finally {
      inFlight.current = false;
    }
  }, [publicKey, signMessage, me, refresh, redirectTo, router]);

  // Step 1 of connect: once `select(Phantom)` has taken effect, call connect().
  // status was already set to "connecting" in onClick before select().
  useEffect(() => {
    if (!pendingConnect.current) return;
    if (wallet?.adapter.name !== PhantomWalletName) return; // wait for select
    pendingConnect.current = false;
    if (connected) return;
    connect()
      .then(() => setStatus("idle"))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Could not connect Phantom";
        if (/reject|denied|cancel/i.test(msg)) {
          setStatus("idle");
          setError(null);
        } else {
          setStatus("error");
          setError(
            /not.*(detect|install)/i.test(msg)
              ? "Phantom not detected. Install it, then reload."
              : msg,
          );
        }
      });
  }, [wallet, connected, connect]);

  // Re-arm auto sign-in when the address changes (incl. -> null on disconnect).
  useEffect(() => {
    if (autoTriedFor.current && autoTriedFor.current !== address) {
      autoTriedFor.current = null;
    }
  }, [address]);

  // Auto sign-in once per address as soon as signing is available.
  useEffect(() => {
    if (!connected || !address || !signMessage || signedIn) return;
    if (autoTriedFor.current === address) return;
    autoTriedFor.current = address;
    void authenticate();
  }, [connected, address, signMessage, signedIn, authenticate]);

  const busy =
    status === "connecting" || status === "signing" || status === "verifying";
  const needsSignIn = connected && !!address && !signedIn;

  const text =
    status === "connecting"
      ? "Opening Phantom…"
      : status === "signing"
        ? "Approve in Phantom…"
        : status === "verifying"
          ? "Verifying…"
          : needsSignIn
            ? "Sign in with wallet"
            : label;

  const onClick = () => {
    setError(null);
    if (needsSignIn || connected) {
      void authenticate();
      return;
    }
    // fresh connect
    pendingConnect.current = true;
    setStatus("connecting");
    select(PhantomWalletName);
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
      {connected && !!address && !signMessage && (
        <button
          className="mt-2 text-xs text-muted underline"
          onClick={() => void disconnect()}
        >
          Reset wallet connection
        </button>
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
