"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Pool {
  resource: "cobalt" | "palladium" | "crystal";
  reserve: number;
  initialReserve: number;
  price: number;
}

const RESOURCE_LABEL: Record<Pool["resource"], string> = {
  cobalt: "Cobalt",
  palladium: "Palladium",
  crystal: "Crystal",
};

export default function ResourceMarketPage() {
  const [pools, setPools] = useState<Pool[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/market/pool")
      .then((r) => r.json())
      .then((d) => {
        if (active) setPools(d.pools ?? []);
      })
      .catch(() => {
        if (active) setPools([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex gap-2 text-sm">
          <Link href="/market" className="text-muted hover:text-foreground">
            Property NFTs
          </Link>
          <span className="text-muted">·</span>
          <span className="font-semibold text-accent-2">Resources</span>
        </div>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Resource Market</h1>
        <p className="mt-1 text-sm text-muted">
          Mining feeds this market. Buying a tool draws from it at the
          current live price - that demand is what moves prices, not manual
          listings. Gold stays off the market; it&apos;s never redeemable
          for $CHIMP.
        </p>
      </div>

      {!pools ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {pools.map((p) => {
            const scarcity = p.reserve / p.initialReserve;
            return (
              <div key={p.resource} className="card p-5">
                <div className="text-xs uppercase tracking-[0.14em] text-muted">
                  {RESOURCE_LABEL[p.resource]}
                </div>
                <div className="mt-2 text-2xl font-bold text-accent">
                  {p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} $CHIMP
                  <span className="ml-1 text-sm font-normal text-muted">/ unit</span>
                </div>
                <div className="mt-3 text-xs text-muted">
                  {p.reserve.toLocaleString()} available
                  {scarcity < 0.5 && (
                    <span className="ml-1 text-bad">· running low</span>
                  )}
                  {scarcity > 1.5 && (
                    <span className="ml-1 text-good">· plentiful</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link href="/missions/mining" className="btn btn-neon w-fit text-xs">
        Mine for ore
      </Link>
    </div>
  );
}
