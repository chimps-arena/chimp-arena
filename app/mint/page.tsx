import Image from "next/image";
import { ChimpMint } from "@/components/chimp-mint";
import { Lamp, PageHeader, Readout, tint } from "@/components/hud";
import { MINT_PRICE_CHIMP } from "@/lib/chain/mint-config";

export const metadata = {
  title: "Mint an Astrochimp",
};

export default function MintPage() {
  return (
    <div className="hud mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        kicker="Mint bay · Astrochimpz collection"
        title="Mint an Astrochimp"
        blurb={`Pay ${MINT_PRICE_CHIMP.toLocaleString()} $CHIMP and get a Standard or Rare Astrochimp, drawn at random. Somewhere out there, hidden One of Ones are waiting to be found.`}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* the bay: character on a lit pad, the draw at a glance */}
        <div
          className="hud-panel flex flex-col items-center gap-5 p-6 sm:p-8"
          style={{ ...tint("var(--hud-amber)"), "--cut": "24px" } as React.CSSProperties}
        >
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 45% at 50% 42%, color-mix(in srgb, var(--hud-amber) 20%, transparent), transparent 70%), radial-gradient(40% 12% at 50% 88%, color-mix(in srgb, var(--hud-cyan) 22%, transparent), transparent 70%)",
            }}
          />
          <div className="hud-label relative flex items-center gap-2 self-start">
            <Lamp color="var(--good)" live /> Bay 01 · ready
          </div>
          <Image
            src="/characters/astrochimp.png"
            alt="Astrochimp"
            width={280}
            height={280}
            className="float-y relative drop-shadow-[0_0_30px_rgba(255,194,58,0.35)]"
            priority
          />
          <div
            className="relative grid w-full grid-cols-3 divide-x border-y py-3 text-center"
            style={{ borderColor: "var(--hud-edge)" }}
          >
            <div style={{ borderColor: "var(--hud-edge)" }}>
              <Readout label="Price" value={MINT_PRICE_CHIMP.toLocaleString()} unit="$CHIMP" color="var(--hud-amber)" size="md" />
            </div>
            <div style={{ borderColor: "var(--hud-edge)" }}>
              <Readout label="Standard" value="85%" size="md" />
            </div>
            <div style={{ borderColor: "var(--hud-edge)" }}>
              <Readout label="Rare" value="15%" color="var(--accent-3)" size="md" />
            </div>
          </div>
          <div className="hud-tag relative" style={tint("var(--hud-amber)")}>
            ✦ Hidden One of Ones · provably fair
          </div>
        </div>

        <ChimpMint />
      </div>
    </div>
  );
}
