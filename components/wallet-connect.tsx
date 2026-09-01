"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useSession } from "@/components/session-provider";

type Status = "idle" | "signing" | "verifying" | "error";

/**
 * Connect a Solana wallet (via the wallet-adapter modal) then run the
 * sign-in-with-signature challenge against /api/auth/*. The wallet address is
 * the identity; signing is gasless and only proves ownership.
 *
 * Flow: click -> wallet picker -> wallet connects -> we auto-run the signature
 * challenge. If the wallet is already connected (e.g. autoConnect on reload)
 * but there's no session yet, the button becomes an explicit "Sign in" so the
 * signature prompt is always tied to a user click.
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
  const { publicKey, connected, connecting, signMessage } = useWallet();
  const { setVisible } = useWalletModal();

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const autoTried = useRef<string | null>(null);

  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage || inFlight.current) return;
    const address = publicKey.toBase58();
    if (me?.player?.wallet === address) return; // already signed in on this wallet

    inFlight.current = true;
    setError(null);
    try {
      setStatus("verifying");
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address }),
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
        body: JSON.stringify({ wallet: address, signature, challengeToken }),
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
      setError(
        e instanceof Error ? e.message : "Something went wrong signing in",
      );
    } finally {
      inFlight.current = false;
    }
  }, [publicKey, signMessage, me, refresh, redirectTo, router]);

  // Best-effort auto sign-in right after a wallet connects. Runs at most once
  // per address; the button is the reliable manual path if a wallet suppresses
  // the prompt outside a click.
  useEffect(() => {
    if (!connected || !publicKey || me?.player) return;
    const addr = publicKey.toBase58();
    if (autoTried.current === addr) return;
    autoTried.current = addr;
    void authenticate();
  }, [connected, publicKey, me, authenticate]);

  const busy = connecting || status === "signing" || status === "verifying";
  const needsSignIn = connected && !!publicKey && !me?.player;

  const text = connecting
    ? "Connecting…"
    : status === "signing"
      ? "Approve in your wallet…"
      : status === "verifying"
        ? "Verifying…"
        : needsSignIn
          ? "Sign in with wallet"
          : label;

  return (
    <div className={className}>
      <button
        className="btn btn-primary w-full sm:w-auto"
        disabled={busy}
        onClick={() => {
          setError(null);
          if (needsSignIn) void authenticate();
          else if (connected) void authenticate();
          else setVisible(true);
        }}
      >
        {busy && <Spinner />}
        {text}
      </button>
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
