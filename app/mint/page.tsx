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
          src="/characters/astrochimp.png"
          alt="Astrochimp"
          width={200}
          height={200}
          className="mx-auto"
          priority
        />
        <h1 className="mt-4 text-2xl font-black">Mint an Astrochimp</h1>
        <p className="mt-1 text-sm text-muted">
          Pay {MINT_PRICE_CHIMP.toLocaleString()} $CHIMP and get a Standard
          or Rare Astrochimp, drawn at random. Somewhere out there, hidden
          One of Ones are waiting to be found.
        </p>
      </div>
      <ChimpMint />
    </div>
  );
}
