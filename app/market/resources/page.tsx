"use client";

import Link from "next/link";
import { PriceTicker } from "@/components/mining/price-ticker";
import { MarketTabs } from "@/components/market-tabs";
import { PageHeader, tint } from "@/components/hud";
import { missionBySlug } from "@/lib/game/config";

export default function ResourceMarketPage() {
  return (
    <div className="hud flex flex-col gap-6">
      <MarketTabs active="resources" />
      <PageHeader
        kicker="Trade terminal · ore exchange"
        title="Resource Market"
        blurb="Mining feeds this market. Buying a tool draws from it at the current live price - that demand is what moves prices, not manual listings. Gold stays off the market; it's never redeemable for $CHIMP."
      />

      <PriceTicker />

      {missionBySlug("mining")?.comingSoon ? (
        <span className="hud-btn hud-btn-ghost w-fit !cursor-default" style={tint("var(--muted)")}>
          Mining · coming soon
        </span>
      ) : (
        <Link href="/missions/mining" className="hud-btn w-fit">
          Mine for ore ▸
        </Link>
      )}
    </div>
  );
}
