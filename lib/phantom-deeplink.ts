"use client";

/**
 * Mobile Phantom: instead of the fragile connect/signMessage deeplink
 * handshake (prone to Phantom's -32603 "unexpected error"), we bounce the
 * user into Phantom's in-app browser with the `browse` deeplink. Inside that
 * browser `window.phantom.solana` is injected, so the normal desktop-style
 * flow in `lib/phantom.ts` works with no encryption / redirect juggling.
 */

export function hasInjectedPhantom(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    phantom?: { solana?: { isPhantom?: boolean } };
  };
  return !!w.phantom?.solana?.isPhantom;
}

/** Mobile browser with no injected provider — the case that needs the bounce. */
export function needsDeeplink(): boolean {
  if (typeof window === "undefined") return false;
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  return mobile && !hasInjectedPhantom();
}

/** Reopen the current page inside Phantom's in-app browser. */
export function openInPhantomBrowser(): void {
  const target = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  window.location.href = `https://phantom.app/ul/browse/${target}?ref=${ref}`;
}
