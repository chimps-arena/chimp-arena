import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, signSession, verifySession } from "@/lib/auth/jwt";

/** Read + verify the current session from the request cookies (server side). */
export async function getSession(): Promise<{ wallet: string } | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Attach a fresh session cookie to a NextResponse. */
export async function setSessionCookie(res: NextResponse, wallet: string) {
  const token = await signSession(wallet);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}
