"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import bs58 from "bs58";
import { Buffer } from "buffer";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useSession } from "@/components/session-provider";
import {
  connectPhantom,
  getPhantom,
  phantomInstalled,
  PHANTOM_INSTALL_URL,
  withPhantomTimeout,
} from "@/lib/phantom";
import { needsDeeplink, openInPhantomBrowser } from "@/lib/phantom-deeplink";

type Status = "idle" | "connecting" | "signing" | "verifying" | "error";
type Method = "message" | "tx";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
// A Ledger waits for button presses on the device - give signing far longer
// than the 15 s "is Phantom stuck?" timeout used for connect.
const SIGN_TIMEOUT_MS = 120_000;
const isRejection = (msg: string) => /reject|denied|cancel|user rejected/i.test(msg);

/**
 * Connect Phantom directly (window.phantom.solana) and run the
 * sign-in-with-signature challenge against /api/auth/*. The session is a
 * 30-day cookie; the wallet is only touched here.
 *
 * Two methods (devlog #25): the usual free message signature, and - for
 * Ledgers, which often can't sign messages (0x6a81) - a memo transaction
 * the wallet signs but we never send. If the message route fails, the
 * transaction route is offered right there.
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
  // Offer the transaction method after a message signature fails.
  const [offerTx, setOfferTx] = useState(false);
  const inFlight = useRef(false);

  // Detect the "mobile browser, no extension" case after mount (avoids a
  // hydration mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobile(needsDeeplink());
  }, []);

  const run = useCallback(async (method: Method = "message") => {
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
        body: JSON.stringify({ wallet: address, mode: method }),
      });
      if (!nonceRes.ok) throw new Error("Could not start sign-in");
      const { message, challengeToken, blockhash } = await nonceRes.json();

      setStatus("signing");
      const provider = getPhantom();
      if (!provider) throw new Error("Phantom not detected");

      let proof: { signature: string } | { transaction: string };
      try {
        if (method === "tx") {
          // Memo-only transaction carrying the sign-in text. Signed, never
          // sent - see verifySignInTransaction for what the server accepts.
          const tx = new Transaction({ feePayer: new PublicKey(address), recentBlockhash: blockhash }).add(
            new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(message, "utf8") }),
          );
          const signed = await withPhantomTimeout(provider.signTransaction(tx), "sign in", SIGN_TIMEOUT_MS);
          proof = { transaction: signed.serialize({ requireAllSignatures: true, verifySignatures: false }).toString("base64") };
        } else {
          const { signature } = await withPhantomTimeout(
            provider.signMessage(new TextEncoder().encode(message), "utf8"),
            "sign message",
            SIGN_TIMEOUT_MS,
          );
          proof = { signature: bs58.encode(signature) };
        }
      } catch (e) {
        // A wallet that can't sign messages (Ledger 0x6a81 and friends):
        // offer the transaction method instead of a dead end.
        if (method === "message" && !isRejection(e instanceof Error ? e.message : "")) setOfferTx(true);
        throw e;
      }

      setStatus("verifying");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address, challengeToken, ...proof }),
      });
      if (!verifyRes.ok) {
        const { error: msg } = await verifyRes.json().catch(() => ({}));
        if (method === "message") setOfferTx(true);
        throw new Error(msg || "Verification failed");
      }
      setOfferTx(false);

      await refresh();
      const nextParam = new URLSearchParams(window.location.search).get("next");
      router.push(redirectTo ?? nextParam ?? "/dashboard");
      router.refresh();
      setStatus("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      if (isRejection(msg)) {
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
      openInPhantomBrowser(); // reopens this page inside Phantom's browser
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
            ? "Reopens this page inside the Phantom app, then connect there."
            : phantomInstalled()
              ? "One free signature to sign in. No transaction."
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
      {!busy && !mobile && phantomInstalled() && (
        offerTx ? (
          <div className="mt-2 max-w-sm border p-3 text-sm" style={{ borderColor: "var(--hud-edge)" }}>
            <p className="text-muted">
              Your wallet couldn&apos;t sign the sign-in message. This is common with Ledger. Sign in with a
              transaction instead: you approve it on your device, but it is never sent and costs nothing.
            </p>
            <button type="button" className="btn btn-primary mt-2" onClick={() => void run("tx")}>
              Sign in with a transaction
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-1 text-xs text-muted underline hover:text-foreground"
            onClick={() => void run("tx")}
          >
            Using a Ledger? Sign in with a transaction
          </button>
        )
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
