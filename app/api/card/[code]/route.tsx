import { ImageResponse } from "next/og";
import { getPilotCard } from "@/lib/pilot-card";

export const runtime = "nodejs";

/**
 * GET /api/card/<code>?m=<missionSlug> -> 1200x630 PNG
 *
 * A player's share card (devlog #30): the link preview on X and Telegram
 * for /p/<code>, and the "Save image" download. Every number comes from
 * lib/pilot-card (our DB), never from the URL. Brand look: purple + gold
 * neon over the lookout-flag scene art.
 */
const GOLD = "#f5c518";
const PURPLE = "#a855f7";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  const card = await getPilotCard(code, url.searchParams.get("m"));
  if (!card) return new Response("not found", { status: 404 });

  const origin = url.origin;
  const crewColor = card.crew?.color ?? PURPLE;
  const stats: [string, string][] = [
    ["Level", String(card.level)],
    ["Total XP", card.xp.toLocaleString("en-US")],
    ["Rank", card.rankName],
  ];
  // A zero streak isn't a brag - only show it once there is one.
  if (card.streak > 0) stats.splice(2, 0, ["Streak", `${card.streak} day${card.streak === 1 ? "" : "s"}`]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0b0614" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${origin}/scenes/lookout-flag.jpg`}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(90deg, rgba(11,6,20,0.97) 0%, rgba(11,6,20,0.9) 50%, rgba(11,6,20,0.55) 75%, rgba(11,6,20,0.2) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 64px",
            width: "100%",
            height: "100%",
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${origin}/brand/chimp-logo-200.png`} alt="" width={64} height={64} style={{ borderRadius: 999 }} />
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 4, color: GOLD }}>ASTROCHIMPZ</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {card.mission ? (
              <div style={{ display: "flex", fontSize: 28, color: PURPLE, letterSpacing: 2 }}>
                {`${card.mission.title.toUpperCase()} · SCORE ${card.mission.score.toLocaleString("en-US")}`}
              </div>
            ) : (
              <div style={{ display: "flex", fontSize: 28, color: PURPLE, letterSpacing: 2 }}>PILOT CARD</div>
            )}
            <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1, maxWidth: 820 }}>{card.handle}</div>
            <div style={{ display: "flex" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  padding: "6px 18px",
                  borderRadius: 999,
                  border: `2px solid ${crewColor}`,
                  background: "rgba(11,6,20,0.72)",
                  color: crewColor,
                }}
              >
                {card.crew ? card.crew.name : "No crew yet"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 20 }}>
            {stats.map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 22px",
                  minWidth: 170,
                  borderRadius: 14,
                  border: `2px solid rgba(245,197,24,0.45)`,
                  background: "rgba(11,6,20,0.72)",
                }}
              >
                <div style={{ display: "flex", fontSize: 20, color: "#c9b8e8", letterSpacing: 2 }}>{label.toUpperCase()}</div>
                <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: GOLD }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", fontSize: 24, color: "#c9b8e8" }}>
            Daily missions on Solana · Play free at astrochimpz.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    },
  );
}
