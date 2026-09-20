"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { explorerAddress } from "@/lib/chain/connection";
import type { Property } from "@/lib/types";

interface Nft {
  asset: string;
  name: string;
  image: string;
  inCollection: boolean;
}

export default function MyAssetsPage() {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [nfts, setNfts] = useState<Nft[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/me/assets")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setProperties(d.properties ?? []);
        setNfts(d.nfts ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-10 py-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">My Assets</h1>
        <p className="mt-1 text-muted">
          Everything you currently own — properties from the Market, and
          Astrochimps NFTs read live from your wallet.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold">
          Properties
          <span className="ml-2 text-sm font-normal text-muted">
            {loading ? "" : `(${properties.length})`}
          </span>
        </h2>
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-40 animate-pulse" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <p className="card mt-4 p-6 text-sm text-muted">
            You don&apos;t own any properties yet.{" "}
            <Link href="/market" className="underline">
              Visit the Market
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                {p.image && (
                  <div className="relative h-32 w-full">
                    <Image src={p.image} alt="" fill className="object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.name}</span>
                    {p.resalePrice != null && (
                      <span className="chip text-xs text-accent-2">Listed</span>
                    )}
                  </div>
                  <div className="mono text-xs text-muted">
                    {p.zone} · {p.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">
          Astrochimps NFTs
          <span className="ml-2 text-sm font-normal text-muted">
            {loading ? "" : `(${nfts.length})`}
          </span>
        </h2>
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card h-48 animate-pulse" />
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <p className="card mt-4 p-6 text-sm text-muted">
            You don&apos;t own any Astrochimps yet.{" "}
            <Link href="/mint" className="underline">
              Mint one
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {nfts.map((n) => (
              <div key={n.asset} className="card overflow-hidden">
                <div className="relative h-32 w-full">
                  <Image src={n.image} alt="" fill className="object-cover" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{n.name}</span>
                    {n.inCollection ? (
                      <span className="chip text-xs text-good" title="3% resale royalty locked to Astro Corp">
                        Royalty-protected
                      </span>
                    ) : (
                      <span className="chip text-xs text-muted" title="Minted before the collection existed - no royalty enforcement">
                        Legacy
                      </span>
                    )}
                  </div>
                  <a
                    href={explorerAddress(n.asset)}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-xs text-muted underline"
                  >
                    {n.asset.slice(0, 4)}…{n.asset.slice(-4)}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
