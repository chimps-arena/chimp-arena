/**
 * NFT art lives on Irys/Arweave, whose gateway is slow - property PNGs are
 * ~2.8 MB and take ~40s each - so cards often never filled in. The site
 * shows small web copies instead (public/nft-thumbs, ~800px WebP), served
 * from our static CDN. They're made by scripts/make-nft-thumbs.mjs; re-run
 * it after uploading new art (anything without a copy falls back to Irys).
 * On-chain metadata keeps pointing at the permanent Arweave originals.
 * Safe on client and server.
 */
import thumbs from "@/lib/nft-thumbs.json";

const IRYS_URL = /^https:\/\/gateway\.irys\.xyz\/([A-Za-z0-9_-]{43,44})\/?$/;
const HAVE = new Set<string>(thumbs);

/** Our fast copy of an Irys image if we have one; anything else unchanged. */
export function fastImage(url: string): string {
  const id = IRYS_URL.exec(url)?.[1];
  return id && HAVE.has(id) ? `/nft-thumbs/${id}.webp` : url;
}
