import { LandMarket } from "@/components/land-market";

export const metadata = {
  title: "Market",
};

export default function MarketPage() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Market</h1>
        <p className="mt-1 text-muted">
          Real property NFTs — permanently yours, tradeable on any
          marketplace that respects the collection, 3% resale royalty locked
          to Astro Corp forever.
        </p>
      </div>
      <LandMarket />
    </div>
  );
}
