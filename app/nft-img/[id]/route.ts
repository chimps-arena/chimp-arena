export const runtime = "nodejs";
// The Irys gateway can take ~30s on a cold image; only the first request per
// image (per CDN region) ever waits on it.
export const maxDuration = 60;

const IRYS_ID = /^[A-Za-z0-9_-]{43,44}$/;

/**
 * GET /nft-img/<irys id> -> the image, cached by the CDN for a year.
 * See lib/nft-image.ts. Only ever fetches gateway.irys.xyz, and only
 * passes images through, so it can't be used as an open proxy.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!IRYS_ID.test(id)) return new Response("bad id", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(`https://gateway.irys.xyz/${id}`, { signal: AbortSignal.timeout(55_000) });
  } catch {
    return new Response("upstream timeout", { status: 504, headers: { "cache-control": "no-store" } });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/")) {
    return new Response("not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": type,
      // Arweave content is immutable - cache it as such, browser and CDN.
      "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
