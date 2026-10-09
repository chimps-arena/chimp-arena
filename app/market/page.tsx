import Link from "next/link";
import { LandMarket } from "@/components/land-market";

export const metadata = {
  title: "Market",
};

export default function MarketPage() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <div>
        <div className="flex gap-2 text-sm">
          <span className="font-semibold text-accent-2">Property NFTs</span>
          <span className="text-muted">·</span>
          <Link href="/market/resources" className="text-muted hover:text-foreground">
            Resources
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Market</h1>
        <p className="mt-1 text-muted">
          Real property NFTs, permanently yours and tradeable on any
          marketplace that respects the collection, with a 3% resale royalty
          locked to Astro Corp forever.
        </p>
      </div>
      <LandMarket />
    </div>
  );
}
