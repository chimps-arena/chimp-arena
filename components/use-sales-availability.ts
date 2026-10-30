"use client";

import { useEffect, useState } from "react";

/**
 * Whether NFT sales (Astrochimp mints, property purchases) can go ahead
 * right now - see app/api/mint/availability. null while loading. A failed
 * check counts as available: the prepare routes enforce the same gate
 * server-side before any payment, so this only decides whether to show the
 * buy button greyed out up front.
 */
export function useSalesAvailability(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/mint/availability", { cache: "no-store" })
      .then((r) => r.json())
      .then((h: { available?: boolean }) => !cancelled && setAvailable(h.available !== false))
      .catch(() => !cancelled && setAvailable(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

export const SALES_UNAVAILABLE_MESSAGE =
  "Temporarily unavailable - our minting service is being topped up. Nothing has been charged; please check back shortly.";
