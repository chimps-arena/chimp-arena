import Image from "next/image";
import Link from "next/link";
import { ChimpGallery } from "@/components/chimp-gallery";
import { ChimpMint } from "@/components/chimp-mint";
import { Lamp, PageHeader, Readout, SectionHeader, tint } from "@/components/hud";
import { MINT_PRICE_CHIMP } from "@/lib/chain/mint-config";

export const metadata = {
  title: "Mint an Astrochimp NFT",
  description: "Mint an Astrochimp NFT with $CHIMP on Solana. Standard and Rare tiers, plus a provably fair bonus One of One every 1,000 mints.",
  alternates: { canonical: "/mint" },
};

// The style gallery reads the live art list; refresh it hourly.
export const revalidate = 3600;

const PERKS = [
  {
    title: "Yours, on-chain",
    blurb: "A Metaplex Core NFT in your own Solana wallet. Hold it, show it, or trade it on the market.",
    color: "var(--hud-cyan)",
  },
  {
    title: "Your pilot in the 3D world",
    blurb: "Your Astrochimp becomes your playable character in the upcoming Astrochimpz 3D world.",
    color: "var(--accent-violet)",
    soon: true,
  },
  {
    title: "A ticket to the bonus draw",
    blurb: "Every mint enters its block of 1,000. When the block fills, one Astrochimp wins a bonus One of One.",
    color: "var(--hud-amber)",
  },
] as const;

export default function MintPage() {
  return (
    <div className="hud mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        kicker="Mint bay · Astrochimpz collection"
        title="Mint an Astrochimp"
        blurb={`Pay ${MINT_PRICE_CHIMP.toLocaleString()} $CHIMP and get a Standard or Rare Astrochimp, drawn at random. Every 1,000 mints, one Astrochimp from the block wins a bonus One of One.`}
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
          <Link href="/fairness" className="hud-tag relative hover:!text-foreground" style={tint("var(--hud-amber)")}>
            ✦ Bonus One of One every 1,000 mints · provably fair ▸
          </Link>
        </div>

        <ChimpMint />
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader title="What you get" />
        <div className="grid gap-4 md:grid-cols-3">
          {PERKS.map((p) => (
            <div key={p.title} className="hud-panel flex flex-col gap-2 p-5" style={tint(p.color)}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold uppercase tracking-wider" style={{ color: p.color }}>{p.title}</span>
                {"soon" in p && <span className="hud-tag" style={tint(p.color)}>Coming soon</span>}
              </div>
              <p className="text-sm text-muted">{p.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <ChimpGallery />
    </div>
  );
}
