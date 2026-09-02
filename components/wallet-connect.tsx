"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import bs58 from "bs58";
import { useSession } from "@/components/session-provider";
import {
  connectPhantom,
  getPhantom,
  phantomInstalled,
  PHANTOM_INSTALL_URL,
} from "@/lib/phantom";
import { needsDeeplink, startConnect } from "@/lib/phantom-deeplink";

type Status = "idle" | "connecting" | "signing" | "verifying" | "error";

/**
 * Connect Phantom directly (window.phantom.solana) and run the
 * sign-in-with-signature challenge against /api/auth/*. The session is a
 * 30-day cookie; the wallet is only touched here.
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
  const { refresh } = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const inFlight = useRef(false);

  // Detect the "mobile browser, no extension" case after mount (avoids a
  // hydration mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobile(needsDeeplink());
  }, []);

  const run = useCallback(async () => {
    if (inFlight.current) return;

    if (!phantomInstalled()) {
      setStatus("error");
      setError(
        "Phantom not detected on this page. Open chrome://extensions, make sure Phantom is enabled with site access 'On all sites', unlock it, then reload. (Not an incognito window.)",
      );
      return;
    }

    inFlight.current = true;
    setError(null);
    try {
      setStatus("connecting");
      const address = await connectPhantom();

      setStatus("verifying");
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      if (!nonceRes.ok) throw new Error("Could not start sign-in");
      const { message, challengeToken } = await nonceRes.json();

      setStatus("signing");
      const provider = getPhantom();
      if (!provider) throw new Error("Phantom not detected");
      const { signature } = await provider.signMessage(
        new TextEncoder().encode(message),
        "utf8",
      );

      setStatus("verifying");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          signature: bs58.encode(signature),
          challengeToken,
        }),
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
      if (/reject|denied|cancel|user rejected/i.test(msg)) {
        setStatus("idle");
        setError(null);
      } else {
        setStatus("error");
        setError(msg);
      }
    } finally {
      inFlight.current = false;
    }
  }, [refresh, redirectTo, router]);

  const busy =
    status === "connecting" || status === "signing" || status === "verifying";
  const text =
    status === "connecting"
      ? "Opening Phantom…"
      : status === "signing"
        ? "Approve in Phantom…"
        : status === "verifying"
          ? "Verifying…"
          : mobile
            ? "Open in Phantom"
            : label;

  const onClick = () => {
    if (mobile) {
      setError(null);
      startConnect(redirectTo); // leaves the page for the Phantom app
      return;
    }
    void run();
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
      {!busy && (
        <p className="mt-2 text-xs text-muted">
          {mobile
            ? "Opens the Phantom app to approve, then returns here."
            : phantomInstalled()
              ? "One free signature to sign in — no transaction."
              : null}
          {!mobile && !phantomInstalled() && (
            <>
              No wallet?{" "}
              <a
                href={PHANTOM_INSTALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Get Phantom
              </a>
              , then reload.
            </>
          )}
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
