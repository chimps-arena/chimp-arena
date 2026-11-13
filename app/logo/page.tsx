import Image from "next/image";
import { PageHeader, SectionHeader } from "@/components/hud";
import { CopyText } from "@/components/copy-text";
import { CHIMP_MINT } from "@/lib/chain/mint-config";

export const metadata = {
  title: "$CHIMP logo",
  alternates: { canonical: "/logo" },
  description: "Official Astrochimpz ($CHIMP) logo files for listings and press.",
};

// Absolute links for listing sites (CoinMarketCap, CoinGecko, ...) that ask
// for a direct image URL rather than a page.
const SITE = "https://astrochimpz.com";

const FILES = [
  { size: "200 × 200", file: "/brand/chimp-logo-200.png", note: "Listing icon (CoinMarketCap)" },
  { size: "512 × 512", file: "/brand/chimp-logo-512.png", note: "Token / DEX / CoinGecko" },
  { size: "1024 × 1024", file: "/brand/chimp-logo.png", note: "Full size" },
];

export default function LogoPage() {
  return (
    <div className="hud mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        kicker="Brand kit · official assets"
        title="$CHIMP logo"
        blurb="The official Astrochimpz ($CHIMP) logo. PNG with a transparent background. Free to use for listings, trackers and press coverage of $CHIMP."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {FILES.map((f) => (
          <div key={f.file} className="hud-panel flex flex-col items-center gap-3 p-5 text-center">
            <div className="grid h-36 w-36 place-items-center">
              <Image src={f.file} alt={`$CHIMP logo ${f.size}`} width={128} height={128} unoptimized />
            </div>
            <div className="hud-value">{f.size}</div>
            <div className="text-xs text-muted">{f.note}</div>
            <a href={f.file} download className="hud-btn w-full !py-2 !text-[0.7rem]">
              Download PNG
            </a>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Direct links" />
        <div className="hud-panel flex flex-col gap-4 p-5">
          {FILES.map((f) => (
            <div key={f.file}>
              <div className="hud-label">{f.size} PNG</div>
              <div className="mt-1">
                <CopyText value={`${SITE}${f.file}`} />
              </div>
            </div>
          ))}
          <div>
            <div className="hud-label">$CHIMP contract address (Solana)</div>
            <div className="mt-1">
              <CopyText value={CHIMP_MINT} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
