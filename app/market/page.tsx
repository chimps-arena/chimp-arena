import { LandMarket } from "@/components/land-market";
import { MarketTabs } from "@/components/market-tabs";
import { PageHeader } from "@/components/hud";

export const metadata = {
  title: "Market",
};

export default function MarketPage() {
  return (
    <div className="hud flex flex-col gap-6">
      <MarketTabs active="properties" />
      <PageHeader
        kicker="Land registry · Astroworld"
        title="Property Market"
        blurb="Real property NFTs, permanently yours and tradeable on any marketplace that respects the collection, with a 3% resale royalty locked to Astro Corp forever."
      />
      <LandMarket />
    </div>
  );
}
