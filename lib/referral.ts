/**
 * Referral codes (migration 0043, devlog #30). Shared by client and server:
 * the cookie name and code format live here so both sides agree.
 *
 * Flow: a share link (/p/<code>, or any page with ?ref=<code>) stores the
 * code in a first-party cookie, first touch wins, for 30 days. When that
 * visitor creates a player (wallet sign-in or guest), the server records
 * who brought them in. Nothing is paid from this yet - see #21.
 */
export const REF_COOKIE = "ac_ref";
export const REF_COOKIE_MAX_AGE = 30 * 86_400;
const REF_CODE_RE = /^[a-f0-9]{10}$/;

export function isRefCode(code: unknown): code is string {
  return typeof code === "string" && REF_CODE_RE.test(code);
}

/** Browser only: remember a referral code unless one is already stored. */
export function rememberRefCode(code: string | null | undefined): void {
  if (!isRefCode(code) || typeof document === "undefined") return;
  if (document.cookie.split("; ").some((c) => c.startsWith(`${REF_COOKIE}=`))) return;
  document.cookie = `${REF_COOKIE}=${code}; Max-Age=${REF_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${
    location.protocol === "https:" ? "; Secure" : ""
  }`;
}
