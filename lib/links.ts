/**
 * The project's official external links, in one place. Socials are
 * separate links on purpose (founders track each one for SEO/analytics).
 */
import { CHIMP_MINT } from "@/lib/chain/mint-config";

export const SOCIAL_LINKS = [
  { name: "X", href: "https://x.com/Astrochimpz" },
  { name: "Telegram", href: "https://t.me/+GF9BxrXnh1E0MGFh" },
  { name: "Discord", href: "https://discord.gg/shyyYd76zd" },
] as const;

export const CHART_URL =
  "https://www.dextools.io/app/solana/pair-explorer/3mGmGvdAqcENBnzEwuTqRuoJwHWrQsVrd79J7PyqAyJV";
export const SOLSCAN_TOKEN_URL = `https://solscan.io/token/${CHIMP_MINT}`;

/** SOL -> $CHIMP on Raydium (the pool the chart tracks). */
export const BUY_CHIMP_URL = `https://raydium.io/swap/?inputMint=So11111111111111111111111111111111111111112&outputMint=${CHIMP_MINT}`;
