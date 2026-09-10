import Image from "next/image";
import { ChimpMint } from "@/components/chimp-mint";
import { SceneBg } from "@/components/scene-bg";
import { MINT_PRICE_CHIMP } from "@/lib/chain/mint-config";

export const metadata = {
  title: "Mint an Astrochimp",
};

export default function MintPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <SceneBg src="/scenes/coin-splash.png" objectPosition="center 20%" opacity={0.4} />
      <div className="text-center">
        <Image
          src="/characters/astrochimp.png"
          alt="Astrochimp"
          width={200}
          height={200}
          className="mx-auto"
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
