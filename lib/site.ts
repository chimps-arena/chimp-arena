/**
 * The public site's address and name for search engines and link previews
 * (titles, canonical links, sitemap, robots). Deliberately separate from
 * NEXT_PUBLIC_SITE_URL, which is baked into NFT metadata links at mint time
 * and must keep working on the old vercel.app domain.
 */
export const SITE_ORIGIN = "https://astrochimpz.com";
export const SITE_NAME = "Astrochimpz";
export const SITE_DESCRIPTION =
  "Astrochimpz is a play-to-earn space game on Solana. Run daily missions, rep your crew, mint Astrochimp NFTs and own property in the Belt with $CHIMP.";

/** Public pages, for the sitemap. */
export const PUBLIC_PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/mint", priority: 0.9 },
  { path: "/market", priority: 0.8 },
  { path: "/leaderboard", priority: 0.7 },
  { path: "/whitepaper", priority: 0.7 },
  { path: "/fairness", priority: 0.5 },
  { path: "/logo", priority: 0.4 },
  { path: "/legal", priority: 0.3 },
];
