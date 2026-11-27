import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPilotCard } from "@/lib/pilot-card";
import { SOCIAL_LINKS } from "@/lib/links";
import { RefCapture } from "@/components/growth/ref-capture";

/**
 * A player's public share page (devlog #30) - what a brag on X or Telegram
 * links to. Its preview image is the player's card; visiting it remembers
 * the player as the referrer (first touch, 30 days - lib/referral.ts), then
 * sends the visitor to play.
 */
type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ m?: string | string[] }>;
};

const TELEGRAM = SOCIAL_LINKS.find((s) => s.name === "Telegram")!.href;

function missionParam(m: string | string[] | undefined): string | null {
  return typeof m === "string" && /^[a-z0-9-]{1,40}$/.test(m) ? m : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { code } = await params;
  const m = missionParam((await searchParams).m);
  const card = await getPilotCard(code, m);
  if (!card) return { title: "Pilot not found", robots: { index: false } };

  const title = card.mission
    ? `${card.handle} scored ${card.mission.score.toLocaleString("en-US")} on ${card.mission.title}`
    : `${card.handle} · Level ${card.level} Astrochimpz pilot`;
  const description = `${card.crew ? `Flying for ${card.crew.name}. ` : ""}Think you can beat that? Daily missions on Solana, free to play.`;
  const image = `/api/card/${card.code}${m ? `?m=${m}` : ""}`;
  return {
    title,
    description,
    robots: { index: false },
    alternates: { canonical: `/p/${card.code}` },
    openGraph: { type: "website", title, description, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", site: "@Astrochimpz", title, description, images: [image] },
  };
}

export default async function PilotPage({ params, searchParams }: Props) {
  const { code } = await params;
  const m = missionParam((await searchParams).m);
  const card = await getPilotCard(code, m);
  if (!card) notFound();

  return (
    <div className="hud mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <RefCapture code={card.code} />
      <div className="hud-label">Incoming transmission</div>
      <h1 className="text-3xl font-bold uppercase leading-tight sm:text-4xl">
        {card.mission ? (
          <>
            {card.handle} scored{" "}
            <span className="text-[color:var(--hud-cyan)]">{card.mission.score.toLocaleString("en-US")}</span> on{" "}
            {card.mission.title}
          </>
        ) : (
          <>{card.handle} wants you in the crew</>
        )}
      </h1>

      {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG, already sized */}
      <img
        src={`/api/card/${card.code}${m ? `?m=${m}` : ""}`}
        alt={`${card.handle}'s Astrochimpz pilot card`}
        width={1200}
        height={630}
        className="hud-panel h-auto w-full !p-0"
      />

      <p className="text-muted">
        Astrochimpz is a space game on Solana. Run daily mini-game missions for XP, push your crew up the board, and
        claim your piece of the world. Free to start, no wallet needed.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="hud-btn">
          Play free ▸
        </Link>
        <a href={TELEGRAM} target="_blank" rel="noopener noreferrer" className="hud-btn hud-btn-ghost">
          Join the Telegram
        </a>
      </div>
    </div>
  );
}
