import { NextResponse } from "next/server";
import { CHIMP_MINT } from "@/lib/chain/mint-config";

export const runtime = "nodejs";

interface DexPair {
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
}

/**
 * Live $CHIMP market stats for the homepage ticker, proxied server-side so
 * the public Dexscreener API key/rate-limit never touches the client and
 * the response can be cached for a few seconds across every visitor.
 */
export async function GET() {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${CHIMP_MINT}`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) throw new Error(`dexscreener ${res.status}`);
    const data = (await res.json()) as { pairs?: DexPair[] };
    const pair = (data.pairs ?? [])
      .slice()
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];

    if (!pair) {
      return NextResponse.json({ available: false as const });
    }

    return NextResponse.json({
      available: true as const,
      priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
      marketCapUsd: pair.marketCap ?? pair.fdv ?? null,
      volume24hUsd: pair.volume?.h24 ?? null,
      liquidityUsd: pair.liquidity?.usd ?? null,
    });
  } catch {
    return NextResponse.json({ available: false as const });
  }
}
