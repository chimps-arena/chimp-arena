import { PropertyMarket } from "@/components/property-market";

export const metadata = {
  title: "Property Market",
};

export default function MarketPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-black">Property Market</h1>
        <p className="mt-1 text-sm text-muted">
          Claim territory across the belt. Paid for in $CHIMP, held by your
          wallet.
        </p>
      </div>
      <PropertyMarket />
    </div>
  );
}
