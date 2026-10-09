"use client";

import Link from "next/link";
import { PriceTicker } from "@/components/mining/price-ticker";

export default function ResourceMarketPage() {
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

      <PriceTicker />

      <Link href="/missions/mining" className="btn btn-neon w-fit text-xs">
        Mine for ore
      </Link>
    </div>
  );
}
