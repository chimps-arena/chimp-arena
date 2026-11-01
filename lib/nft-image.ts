/**
 * NFT art lives on Irys/Arweave, whose gateway takes 10-30s per image -
 * slow enough that mint reveals, My Assets and wallets often gave up.
 * Arweave content never changes, so app/nft-img serves it from our own
 * domain with a permanent CDN cache: one slow fetch, fast forever after.
 * Safe on client and server.
 */
const IRYS_URL = /^https:\/\/gateway\.irys\.xyz\/([A-Za-z0-9_-]{43,44})\/?$/;

/** Rewrites an Irys gateway URL to our cached copy; anything else unchanged.
 *  `origin` makes it absolute (wallet metadata needs that). */
export function fastImage(url: string, origin = ""): string {
  const m = IRYS_URL.exec(url);
  return m ? `${origin}/nft-img/${m[1]}` : url;
}
