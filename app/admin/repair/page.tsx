import { NftRepair } from "@/components/nft-repair";

export const metadata = {
  title: "NFT Collection Repair",
};

export default function RepairPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-black">Collection Repair</h1>
        <p className="mt-1 text-sm text-muted">
          Puts NFTs you bought from us into their official collection, so the
          3% resale royalty covers them.
        </p>
      </div>
      <NftRepair />
    </div>
  );
}
