"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { explorerAddress } from "@/lib/chain/connection";
import { ResaleControls } from "@/components/resale-controls";
import { HoloCard } from "@/components/holo-card";
import type { Property } from "@/lib/types";
import { PageHeader, SectionHeader, tint } from "@/components/hud";

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

  function loadAssets() {
    return fetch("/api/me/assets")
      .then((r) => r.json())
      .then((d) => {
        setProperties(d.properties ?? []);
        setNfts(d.nfts ?? []);
      });
  }

  useEffect(() => {
    let active = true;
    loadAssets().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="hud flex flex-col gap-10">
      <PageHeader
        kicker="Hangar · inventory"
        title="My Assets"
        blurb="Everything you currently own: properties from the Market, and Astrochimps NFTs read live from your wallet."
      />

      <section>
        <SectionHeader title="Properties" aside={loading ? undefined : `${properties.length} owned`} />
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="hud-panel h-40 animate-pulse" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <p className="hud-panel mt-4 p-6 text-sm text-muted">
            You don&apos;t own any properties yet.{" "}
            <Link href="/market" className="underline">
              Visit the Market
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <div key={p.id} className="hud-panel overflow-hidden">
                {p.image && (
                  <div className="relative aspect-[4/3] w-full">
                    <Image src={p.image} alt="" fill className="object-cover" unoptimized />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold uppercase">{p.name}</h3>
                    {p.assetAddress ? (
                      <span className="hud-tag" style={tint("var(--good)")} title="3% resale royalty locked to Astro Corp">
                        NFT
                      </span>
                    ) : (
                      p.resalePrice != null && (
                        <span className="hud-tag" style={tint("var(--hud-cyan)")}>Listed</span>
                      )
                    )}
                  </div>
                  <div className="mono text-xs text-muted">
                    {p.zone} · {p.type}
                  </div>
                  {p.assetAddress ? (
                    <a
                      href={explorerAddress(p.assetAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-xs text-muted underline"
                    >
                      Trade this on any marketplace that supports the collection
                    </a>
                  ) : (
                    <ResaleControls
                      propertyId={p.id}
                      resalePrice={p.resalePrice}
                      onChange={loadAssets}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Astrochimps" aside={loading ? undefined : `${nfts.length} in wallet`} />
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="hud-panel h-48 animate-pulse" />
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <p className="hud-panel mt-4 p-6 text-sm text-muted">
            You don&apos;t own any Astrochimps yet.{" "}
            <Link href="/mint" className="underline">
              Mint one
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {nfts.map((n) => (
              <div key={n.asset} className="hud-panel overflow-hidden">
                <HoloCard className="block">
                  <div className="relative aspect-square w-full">
                    <Image src={n.image} alt="" fill className="object-cover" />
                  </div>
                </HoloCard>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-bold uppercase">{n.name}</h3>
                    {n.inCollection ? (
                      <span className="hud-tag shrink-0" style={tint("var(--good)")} title="3% resale royalty locked to Astro Corp">
                        Protected
                      </span>
                    ) : (
                      <span className="hud-tag shrink-0" title="Not in the official collection yet - fix it at /admin/repair">
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
