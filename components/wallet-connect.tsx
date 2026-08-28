"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  connectPhantom,
  getPhantom,
  PHANTOM_INSTALL_URL,
} from "@/lib/phantom";
import { useSession } from "@/components/session-provider";

type Status = "idle" | "connecting" | "signing" | "verifying" | "error";

export function WalletConnect({
  redirectTo,
  className = "",
  label = "Connect Phantom",
}: {
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const { refresh } = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);

    if (!getPhantom()) {
      window.open(PHANTOM_INSTALL_URL, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      setStatus("connecting");
      const wallet = await connectPhantom();
      if (!wallet) throw new Error("Phantom not available");

      setStatus("verifying");
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: wallet.address }),
      });
      if (!nonceRes.ok) throw new Error("Could not start sign-in");
      const { message, challengeToken } = await nonceRes.json();

      setStatus("signing");
      const signature = await wallet.signMessage(message);

      setStatus("verifying");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: wallet.address, signature, challengeToken }),
      });
      if (!verifyRes.ok) {
        const { error: msg } = await verifyRes.json().catch(() => ({}));
        throw new Error(msg || "Verification failed");
      }

      await refresh();
      const nextParam = new URLSearchParams(window.location.search).get("next");
      router.push(redirectTo ?? nextParam ?? "/dashboard");
      router.refresh();
    } catch (e) {
      setStatus("error");
      setError(
        e instanceof Error ? e.message : "Something went wrong connecting",
      );
      return;
    }
    setStatus("idle");
  }, [refresh, redirectTo, router]);

  const busy = status === "connecting" || status === "signing" || status === "verifying";
  const text =
    status === "connecting"
      ? "Opening Phantom…"
      : status === "signing"
        ? "Sign the message…"
        : status === "verifying"
          ? "Verifying…"
          : label;

  return (
    <div className={className}>
      <button
        className="btn btn-primary w-full sm:w-auto"
        onClick={run}
        disabled={busy}
      >
        {busy && <Spinner />}
        {text}
      </button>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {!getPhantomSafe() && (
        <p className="mt-2 text-xs text-muted">
          No Phantom detected — the button will take you to the install page.
        </p>
      )}
    </div>
  );
}

function getPhantomSafe() {
  try {
    return Boolean(getPhantom());
  } catch {
    return false;
  }
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
