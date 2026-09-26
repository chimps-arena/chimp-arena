"use client";

import { useState } from "react";

/**
 * List/delist a legacy (non-NFT) property for resale - the last remaining
 * use of the old off-chain resale mechanism (app/api/market/list,
 * app/api/market/resale/claim), kept specifically for the 5 properties
 * still owned from before the NFT relaunch. A real NFT property trades
 * on-chain instead and never shows this control - see the assetAddress
 * check at the call site.
 */
export function ResaleControls({
  propertyId,
  resalePrice,
  onChange,
}: {
  propertyId: string;
  resalePrice: number | null;
  onChange: () => void;
}) {
  const [price, setPrice] = useState(resalePrice ? String(resalePrice) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(priceChimp: number | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/market/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, priceChimp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update the listing");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the listing");
    } finally {
      setBusy(false);
    }
  }

  if (resalePrice != null) {
    return (
      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted">
          Listed for resale at{" "}
          <span className="font-semibold text-accent-2">
            {resalePrice.toLocaleString()} $CHIMP
          </span>
        </p>
        <button
          className="btn btn-ghost text-xs"
          disabled={busy}
          onClick={() => void submit(null)}
        >
          {busy ? "Cancelling…" : "Cancel listing"}
        </button>
        {error && <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          placeholder="Price in $CHIMP"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground"
        />
        <button
          className="btn btn-ghost shrink-0 text-xs"
          disabled={busy || !price || Number(price) <= 0}
          onClick={() => void submit(Number(price))}
        >
          {busy ? "Listing…" : "List"}
        </button>
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
