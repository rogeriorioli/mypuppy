import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-cookie";
import { hasValidSessionToken } from "@/lib/session-token";

const PUBLIC_PATHS = ["/", "/signin", "/signup"];

/**
 * Proxy (Next 16 replacement for middleware). Performs a fast signature
 * check on the session cookie for route guarding. Full authorization
 * (session existence in DB + user/pet ownership) is enforced again in every
 * server action and route handler.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await hasValidSessionToken(token);

  const isPublic = PUBLIC_PATHS.includes(pathname);
  if (isPublic && valid && (pathname === "/signin" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/pet", request.url));
  }
  if (!isPublic && !valid) {
    const target = pathname === "/" ? new URL("/", request.url) : new URL("/signin", request.url);
    return NextResponse.redirect(target);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webmanifest|ico|js|map)$).*)"],
};
