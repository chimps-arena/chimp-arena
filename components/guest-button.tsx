"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";

/**
 * Wallet-free entry so anyone (founders, first-time visitors) can play
 * immediately. Creates a throwaway "Guest-xxxx" player + session.
 */
export function GuestButton({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const { refresh } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) throw new Error("Could not start guest session");
      await refresh();
      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="btn btn-ghost w-full sm:w-auto"
        onClick={go}
        disabled={busy}
      >
        {busy ? "Starting…" : "Play as guest"}
      </button>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
