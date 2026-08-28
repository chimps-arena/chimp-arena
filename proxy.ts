import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";

const PROTECTED = ["/dashboard", "/missions", "/crews"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("next", pathname);
  url.searchParams.set("connect", "1");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/missions/:path*", "/crews/:path*"],
};
