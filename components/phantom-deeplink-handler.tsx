"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import {
  clearDeeplinkState,
  finishConnect,
  finishSignMessage,
  stashChallengeToken,
  startSignMessage,
} from "@/lib/phantom-deeplink";

/**
 * Handles the return leg of a Phantom mobile deeplink. Mounted once, app-wide.
 * Reads `?pd=connect` / `?pd=sign` from the URL, advances the login, and
 * cleans the URL + storage afterwards.
 */
export function PhantomDeeplinkHandler() {
  const { refresh } = useSession();
  const router = useRouter();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    const sp = new URLSearchParams(window.location.search);
    const phase = sp.get("pd");
    if (phase !== "connect" && phase !== "sign") return;
    ran.current = true;

    (async () => {
      try {
        if (phase === "connect") {
          const { address } = finishConnect(sp);
          const nonceRes = await fetch("/api/auth/nonce", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ wallet: address }),
          });
          if (!nonceRes.ok) throw new Error("Could not start sign-in");
          const { message, challengeToken } = await nonceRes.json();
          stashChallengeToken(challengeToken);
          startSignMessage(message); // redirects away
          return;
        }

        // phase === "sign"
        const { address, signature, challengeToken, redirectTo } =
          finishSignMessage(sp);
        const verifyRes = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet: address, signature, challengeToken }),
        });
        if (!verifyRes.ok) {
          const { error: msg } = await verifyRes.json().catch(() => ({}));
          throw new Error(msg || "Verification failed");
        }
        clearDeeplinkState();
        window.history.replaceState({}, "", window.location.pathname);
        await refresh();
        router.replace(redirectTo);
        router.refresh();
      } catch (e) {
        clearDeeplinkState();
        window.history.replaceState({}, "", window.location.pathname);
        setError(
          e instanceof Error ? e.message : "Phantom sign-in failed — try again",
        );
      }
    })();
  }, [refresh, router]);

  if (!error) return null;
  return (
    <div className="border-b border-bad/40 bg-bad/10 px-4 py-2 text-center text-sm text-bad">
      {error}
    </div>
  );
}
