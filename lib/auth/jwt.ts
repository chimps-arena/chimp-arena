import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { serverEnv } from "@/lib/env";

function key() {
  return new TextEncoder().encode(serverEnv().jwtSecret);
}

export const SESSION_COOKIE = "chimp_session";
const SESSION_TTL = "30d";

/* --------------------------- session tokens --------------------------- */

export async function signSession(wallet: string): Promise<string> {
  return new SignJWT({ wallet })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(wallet)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .setAudience("chimp-arena:session")
    .sign(key());
}

export async function verifySession(
  token: string | undefined,
): Promise<{ wallet: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      audience: "chimp-arena:session",
    });
    const wallet = (payload.sub ?? payload.wallet) as string | undefined;
    if (!wallet) return null;
    return { wallet };
  } catch {
    return null;
  }
}

/* -------------------- generic short-lived JWTs -------------------- */

/** Sign an arbitrary payload with a short TTL (e.g. "5m", "3m"). */
export async function signShortLived(
  payload: JWTPayload,
  audience: string,
  ttl: string,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .setAudience(audience)
    .sign(key());
}

export async function verifyShortLived<T = JWTPayload>(
  token: string,
  audience: string,
): Promise<(T & JWTPayload) | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { audience });
    return payload as T & JWTPayload;
  } catch {
    return null;
  }
}
