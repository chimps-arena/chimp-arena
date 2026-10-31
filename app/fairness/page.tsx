import Link from "next/link";
import { Lamp, PageHeader, Readout, SectionHeader, tint } from "@/components/hud";
import { CopyText } from "@/components/copy-text";
import { fairnessReport } from "@/lib/chain/fairness-report";
import { explorerAddress } from "@/lib/chain/connection";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Provably fair bonus draw",
  description: "How the hidden bonus One of One Astrochimp is drawn, and how to verify it yourself.",
};

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

  const current = report.blocks.find((b) => b.block === report.currentBlock)!;
  const upcoming = report.blocks.filter((b) => b.block > report.currentBlock);
  const finished = report.blocks.filter((b) => b.block < report.currentBlock).reverse();
  const [, hi] = current.mints.split("-").map(Number);
  const blockStart = Number(current.mints.split("-")[0]);
  const progress = Math.min(100, ((report.latestMint - blockStart + 1) / (hi - blockStart + 1)) * 100);

  return (
    <div className="hud mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        kicker="Mint bay · bonus draw"
        title="Provably fair"
        blurb="One mint in every block of 1,000 carries a hidden bonus One of One Astrochimp. Nobody - including us - can see or move which one, and you can check that yourself."
      />

      {/* ---------- current block ---------- */}
      <section
        className="hud-panel hud-panel-hot flex flex-col gap-5 p-6"
        style={{ ...tint("var(--hud-amber)"), "--cut": "20px" } as React.CSSProperties}
      >
        <div className="hud-label flex items-center gap-2 !text-[color:var(--hud-amber)]">
          <Lamp color="var(--hud-amber)" live /> Block {current.block} · draw in progress
        </div>
        <div
          className="grid grid-cols-3 divide-x border-y py-3"
          style={{ borderColor: "var(--hud-edge)" }}
        >
          <div className="pr-3" style={{ borderColor: "var(--hud-edge)" }}>
            <Readout label="Mints" value={current.mints.replace("-", "–")} size="md" />
          </div>
          <div className="px-3" style={{ borderColor: "var(--hud-edge)" }}>
            <Readout label="Winner drawn from" value={current.drawRange.replace("-", "–")} size="md" color="var(--hud-amber)" />
          </div>
          <div className="pl-3" style={{ borderColor: "var(--hud-edge)" }}>
            <Readout label="Minted so far" value={report.latestMint.toLocaleString()} size="md" />
          </div>
        </div>
        <div>
          <div className="hud-gauge">
            <div className="hud-gauge-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="mono mt-1 text-[11px] text-muted">
            {report.latestMint.toLocaleString()} of {hi.toLocaleString()} · the bonus is somewhere ahead
            {current.awardedToMint ? " - already found this block" : ""}
          </div>
        </div>
        <div>
          <div className="hud-label">Sealed commitment</div>
          <p className="mt-1 text-xs text-muted">
            The fingerprint of this block&apos;s secret, published before the block started. The secret is
            revealed here when the block ends.
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
            "Each block of 1,000 mints gets its own secret, generated on our server and never shown while the block is running.",
            "The winning mint number is calculated from that secret. The bonus goes to the first mint at or after it - one per block.",
            "Before a block starts we publish a fingerprint (SHA-256 hash) of its secret. A fingerprint can't be reversed to find the secret, but it locks it in: any change would produce a different fingerprint.",
            "When the block ends, the secret is revealed below. Anyone can check it matches the fingerprint and recompute the winner.",
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
                <span className="hud-label">Block {b.block} · mints {b.mints.replace("-", "–")}</span>
                <span className="hud-label">Not started</span>
              </div>
              <CopyText value={b.commitment} />
            </div>
          ))}
        </section>
      )}

      {/* ---------- finished blocks ---------- */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Revealed draws" aside={`${finished.length} finished`} />
        {finished.length === 0 ? (
          <p className="hud-panel p-5 text-sm text-muted">
            No block has finished yet - the first secret is revealed after mint #1,000.
          </p>
        ) : (
          finished.map((b) => (
            <div key={b.block} className="hud-panel flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="hud-label">Block {b.block} · mints {b.mints.replace("-", "–")}</span>
                <span className="hud-value text-[color:var(--hud-amber)]">winning mint #{b.winningMint}</span>
              </div>
              <div>
                <div className="hud-label">Commitment</div>
                <CopyText value={b.commitment} />
              </div>
              <div>
                <div className="hud-label">Revealed secret</div>
                <CopyText value={b.secret!} />
              </div>
              {b.bonusAsset && (
                <a href={explorerAddress(b.bonusAsset)} target="_blank" rel="noopener noreferrer" className="mono text-xs underline">
                  Bonus went to mint #{b.awardedToMint} ↗
                </a>
              )}
            </div>
          ))
        )}
      </section>

      {/* ---------- verify ---------- */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Verify it yourself" />
        <div className="hud-panel flex flex-col gap-3 p-5 text-sm text-muted">
          <p>For any finished block:</p>
          <p>
            <span className="text-foreground">1.</span> SHA-256 of the revealed secret must equal the commitment.
          </p>
          <p>
            <span className="text-foreground">2.</span> Take SHA-256 of <span className="mono text-foreground">winner:</span>{" "}
            followed by the secret. Read its first 12 hex digits as a number, divide by the size of the draw range, and
            add the remainder to the range&apos;s first mint. That&apos;s the winning mint.
          </p>
          <p>
            Machine-readable record:{" "}
            <a href="/api/mint/fairness" className="mono underline hover:text-foreground">
              /api/mint/fairness
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
