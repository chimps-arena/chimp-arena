"use client";

/**
 * Phantom mobile deeplinks (for a plain mobile browser with no injected
 * provider). Encrypted handshake per
 * https://docs.phantom.com/phantom-deeplinks/deeplinks-ios-and-android
 *
 * Flow: startConnect() redirects to Phantom -> Phantom returns to
 * `?pd=connect` -> finishConnect() -> startSignMessage() redirects to Phantom
 * -> returns to `?pd=sign` -> finishSignMessage(). State survives the app
 * switch in localStorage and is cleared on completion.
 */
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PUBLIC_ENV } from "@/lib/env";

const BASE = "https://phantom.app/ul/v1";

const K = {
  secret: "pd.dappSecret",
  shared: "pd.shared",
  session: "pd.session",
  address: "pd.address",
  challenge: "pd.challengeToken",
  redirect: "pd.redirectTo",
} as const;

const enc = (u: Uint8Array) => bs58.encode(u);
const dec = (s: string) => bs58.decode(s);

export function hasInjectedPhantom(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { phantom?: { solana?: { isPhantom?: boolean } } };
  return !!w.phantom?.solana?.isPhantom;
}

/** A mobile browser with no extension — the case deeplinks exist for. */
export function needsDeeplink(): boolean {
  if (typeof window === "undefined") return false;
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  return mobile && !hasInjectedPhantom();
}

/** Clean path with no query string — Phantom appends its response params to it. */
function redirectLink(phase: "connect" | "sign"): string {
  return `${window.location.origin}/phantom/${phase}`;
}

/** Step 1 — leave for the Phantom app to approve a connection. */
export function startConnect(redirectTo?: string): void {
  const kp = nacl.box.keyPair();
  localStorage.setItem(K.secret, enc(kp.secretKey));
  if (redirectTo) localStorage.setItem(K.redirect, redirectTo);

  const params = new URLSearchParams({
    app_url: window.location.origin,
    dapp_encryption_public_key: enc(kp.publicKey),
    redirect_link: redirectLink("connect"),
    cluster: PUBLIC_ENV.solanaCluster,
  });
  // External URL (the Phantom app), not an internal route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${BASE}/connect?${params.toString()}`;
}

/** Step 2 — decrypt Phantom's connect response. Returns the wallet address. */
export function finishConnect(search: URLSearchParams): { address: string } {
  const errCode = search.get("errorCode");
  if (errCode) {
    throw new Error(search.get("errorMessage") || `Phantom error ${errCode}`);
  }
  const phantomPub = search.get("phantom_encryption_public_key");
  const nonce = search.get("nonce");
  const data = search.get("data");
  const secretB58 = localStorage.getItem(K.secret);
  if (!phantomPub || !nonce || !data || !secretB58) {
    throw new Error("Incomplete Phantom connect response");
  }

  const shared = nacl.box.before(dec(phantomPub), dec(secretB58));
  const opened = nacl.box.open.after(dec(data), dec(nonce), shared);
  if (!opened) throw new Error("Could not decrypt Phantom response");

  const payload = JSON.parse(new TextDecoder().decode(opened)) as {
    public_key: string;
    session: string;
  };
  localStorage.setItem(K.shared, enc(shared));
  localStorage.setItem(K.session, payload.session);
  localStorage.setItem(K.address, payload.public_key);
  return { address: payload.public_key };
}

export function stashChallengeToken(token: string): void {
  localStorage.setItem(K.challenge, token);
}

/** Step 3 — leave for the Phantom app to sign the login message. */
export function startSignMessage(message: string): void {
  const sharedB58 = localStorage.getItem(K.shared);
  const session = localStorage.getItem(K.session);
  const secretB58 = localStorage.getItem(K.secret);
  if (!sharedB58 || !session || !secretB58) {
    throw new Error("No Phantom session — connect again");
  }

  const shared = dec(sharedB58);
  const body = JSON.stringify({
    message: bs58.encode(new TextEncoder().encode(message)),
    session,
    display: "utf8",
  });
  const nonce = nacl.randomBytes(24);
  const box = nacl.box.after(new TextEncoder().encode(body), nonce, shared);

  const params = new URLSearchParams({
    dapp_encryption_public_key: enc(
      nacl.box.keyPair.fromSecretKey(dec(secretB58)).publicKey,
    ),
    nonce: enc(nonce),
    redirect_link: redirectLink("sign"),
    payload: enc(box),
  });
  // External URL (the Phantom app), not an internal route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${BASE}/signMessage?${params.toString()}`;
}

/** Step 4 — decrypt the signature (already base58). */
export function finishSignMessage(search: URLSearchParams): {
  address: string;
  signature: string;
  challengeToken: string;
  redirectTo: string;
} {
  const errCode = search.get("errorCode");
  if (errCode) {
    throw new Error(search.get("errorMessage") || `Phantom error ${errCode}`);
  }
  const nonce = search.get("nonce");
  const data = search.get("data");
  const sharedB58 = localStorage.getItem(K.shared);
  if (!nonce || !data || !sharedB58) {
    throw new Error("Incomplete Phantom sign response");
  }
  const opened = nacl.box.open.after(dec(data), dec(nonce), dec(sharedB58));
  if (!opened) throw new Error("Could not decrypt Phantom sign response");

  const payload = JSON.parse(new TextDecoder().decode(opened)) as {
    signature: string;
  };
  const address = localStorage.getItem(K.address);
  const challengeToken = localStorage.getItem(K.challenge);
  if (!address || !challengeToken) throw new Error("Lost sign-in state");

  return {
    address,
    signature: payload.signature,
    challengeToken,
    redirectTo: localStorage.getItem(K.redirect) || "/dashboard",
  };
}

export function clearDeeplinkState(): void {
  Object.values(K).forEach((k) => localStorage.removeItem(k));
}
