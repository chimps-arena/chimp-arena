import Image from "next/image";
import { ChimpMint } from "@/components/chimp-mint";
import { MINT_PRICE_CHIMP } from "@/lib/chain/mint-config";

export const metadata = {
  title: "Mint an Astrochimp",
};

export default function MintPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="text-center">
        <Image
          src="/nft/astrochimp.svg"
          alt="Astrochimp"
          width={180}
          height={180}
          className="mx-auto rounded-2xl border border-border"
          priority
        />
        <h1 className="mt-4 text-2xl font-black">Mint an Astrochimp</h1>
        <p className="mt-1 text-sm text-muted">
          Test mint. Pay {MINT_PRICE_CHIMP.toLocaleString()} $CHIMP, get an NFT.
          Placeholder art — the real character drops later.
        </p>
      </div>
      <ChimpMint />
    </div>
  );
}
