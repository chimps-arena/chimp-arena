import Link from "next/link";
import { Lamp, PageHeader, Readout, SectionHeader, tint } from "@/components/hud";
import { CopyText } from "@/components/copy-text";
import { fairnessReport } from "@/lib/chain/fairness-report";
import { explorerAddress, explorerTx } from "@/lib/chain/connection";
import { shortWallet } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Provably fair bonus draw",
  alternates: { canonical: "/fairness" },
  description: "How the bonus One of One Astrochimp is drawn after every 1,000 mints, and how to verify it yourself.",
};

const dash = (range: string) => range.replace("-", "–");

export default async function FairnessPage() {
  const report = await fairnessReport();

  if (!report) {
    return (
      <div className="hud">
        <div className="hud-panel mx-auto mt-10 max-w-lg p-8 text-center">
          <h1 className="text-2xl font-bold uppercase">Bonus draw</h1>
          <p className="mt-2 text-sm text-muted">The draw record is temporarily unavailable. Please check back shortly.</p>
        </div>
      </div>
    );
  }

  // The earliest block that isn't drawn yet is the one in play.
  const current = report.blocks.find((b) => b.status === "open" || b.status === "drawing")!;
  const upcoming = report.blocks.filter((b) => b.status === "upcoming");
  const drawn = report.blocks.filter((b) => b.status === "drawn").reverse();
  const [blockStart, hi] = current.mints.split("-").map(Number);
  const minted = Math.max(0, Math.min(report.latestMint, hi) - blockStart + 1);
  const progress = (minted / (hi - blockStart + 1)) * 100;

  return (
    <div className="hud mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        kicker="Mint bay · bonus draw"
        title="Provably fair"
        blurb="Every 1,000 mints, one Astrochimp from that block is drawn to win a bonus One of One. The draw only happens once the block is full - nobody, including us, can know the winner before then, and you can check it yourself."
      />

      {/* ---------- block in play ---------- */}
      <section
        className="hud-panel hud-panel-hot flex flex-col gap-5 p-6"
        style={{ ...tint("var(--hud-amber)"), "--cut": "20px" } as React.CSSProperties}
      >
        <div className="hud-label flex items-center gap-2 !text-[color:var(--hud-amber)]">
          <Lamp color="var(--hud-amber)" live />
          Block {current.block} · {current.status === "drawing" ? "full - drawing now" : "open"}
        </div>
        <div className="grid grid-cols-3 divide-x border-y py-3" style={{ borderColor: "var(--hud-edge)" }}>
          <div className="pr-3" style={{ borderColor: "var(--hud-edge)" }}>
            <Readout label="Mints" value={dash(current.mints)} size="md" />
          </div>
          <div className="px-3" style={{ borderColor: "var(--hud-edge)" }}>
            <Readout label="In the draw" value={`#${dash(current.drawRange)}`} size="md" color="var(--hud-amber)" />
          </div>
          <div className="pl-3" style={{ borderColor: "var(--hud-edge)" }}>
            <Readout label="Draw at" value={`#${hi.toLocaleString()}`} size="md" />
          </div>
        </div>
        <div>
          <div className="hud-gauge">
            <div className="hud-gauge-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="mono mt-1 text-[11px] text-muted">
            {Math.min(report.latestMint, hi).toLocaleString()} of {hi.toLocaleString()} minted · the winner is drawn
            when the block fills
          </div>
        </div>
        <div>
          <div className="hud-label">Sealed commitment</div>
          <p className="mt-1 text-xs text-muted">
            The fingerprint of this block&apos;s secret, published before minting began. The secret is revealed
            here after the draw.
          </p>
          <div className="mt-2">
            <CopyText value={current.commitment} />
          </div>
        </div>
        <Link href="/mint" className="hud-btn self-start">
          Mint an Astrochimp ▸
        </Link>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="How it works" />
        <ol className="hud-panel flex flex-col gap-3 p-5 text-sm text-muted">
          {[
            "Every block of 1,000 mints has its own secret, sealed before minting starts. We publish its fingerprint (a SHA-256 hash): it can't be reversed to find the secret, but it locks the secret in.",
            "Nobody wins while the block is open - every mint in the draw range is a ticket until the block fills.",
            "When the last mint of the block lands, the draw runs automatically. It mixes the sealed secret with the Solana blockhash of that closing mint - a value that didn't exist until that moment, so nobody could know the result in advance, us included.",
            "Whoever holds the winning Astrochimp at draw time gets the bonus One of One airdropped. The secret is then revealed here so anyone can recompute the draw.",
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="hud-tag h-fit shrink-0" style={tint("var(--hud-cyan)")}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- next block ---------- */}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Already sealed" aside="next block" />
          {upcoming.map((b) => (
            <div key={b.block} className="hud-panel flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="hud-label">Block {b.block} · mints {dash(b.mints)}</span>
                <span className="hud-label">Not started</span>
              </div>
              <CopyText value={b.commitment} />
            </div>
          ))}
        </section>
      )}

      {/* ---------- results ---------- */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Draw results" aside={`${drawn.length} drawn`} />
        {drawn.length === 0 ? (
          <p className="hud-panel p-5 text-sm text-muted">
            No draw yet - the first one runs when mint #1,000 lands.
          </p>
        ) : (
          drawn.map((b) => (
            <div key={b.block} className="hud-panel flex flex-col gap-3 p-5" style={tint("var(--hud-amber)")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="hud-label">Block {b.block} · {b.poolSize} mints in the draw</span>
                <span className="hud-value text-[color:var(--hud-amber)]">Winner: mint #{b.winningMint}</span>
              </div>
              <p className="text-sm text-muted">
                Bonus One of One {b.bonusAsset ? "sent" : "being sent"} to{" "}
                <span className="mono text-foreground">{shortWallet(b.bonusRecipient!)}</span>
                {b.bonusAsset && (
                  <>
                    {" · "}
                    <a href={explorerAddress(b.bonusAsset)} target="_blank" rel="noopener noreferrer" className="underline">
                      view NFT ↗
                    </a>
                  </>
                )}
              </p>
              <div>
                <div className="hud-label">Commitment</div>
                <CopyText value={b.commitment} />
              </div>
              <div>
                <div className="hud-label">Revealed secret</div>
                <CopyText value={b.secret!} />
              </div>
              <div>
                <div className="hud-label">Closing blockhash · slot {b.closeSlot?.toLocaleString()}</div>
                <CopyText value={b.closeBlockhash!} />
                <a href={explorerTx(b.closeSignature!)} target="_blank" rel="noopener noreferrer" className="mono mt-1 inline-block text-xs underline">
                  closing mint transaction ↗
                </a>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ---------- verify ---------- */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Verify it yourself" />
        <div className="hud-panel flex flex-col gap-3 p-5 text-sm text-muted">
          <p>For any drawn block:</p>
          <p>
            <span className="text-foreground">1.</span> SHA-256 of the revealed secret must equal the commitment
            published before the block started.
          </p>
          <p>
            <span className="text-foreground">2.</span> Take SHA-256 of <span className="mono text-foreground">winner:</span>
            {" + secret + "}
            <span className="mono text-foreground">:</span>
            {" + closing blockhash. Read its first 12 hex digits as a number and divide by the number of mints in the draw - the remainder is the winner's position in the pool (lowest mint number first)."}
          </p>
          <p>
            <span className="text-foreground">3.</span> The closing blockhash is public on Solana: look up the slot of
            the closing mint transaction.
          </p>
          <p>
            Full record, including each pool:{" "}
            <a href="/api/mint/fairness" className="mono underline hover:text-foreground">
              /api/mint/fairness
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
