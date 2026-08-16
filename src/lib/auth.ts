import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth-cookie";

export { SESSION_COOKIE };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  return new TextEncoder().encode(getServerEnv().SESSION_SECRET);
}

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.session.create({
    data: { userId, expiresAt },
  });
  const token = await new SignJWT({ sid: session.id, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt)
    .sign(secret());
  return token;
}

export function setSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Full server-side session validation: signature + expiry + DB lookup.
 * Client-provided values are never trusted; the session id only comes from
 * the signed httpOnly cookie.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let sid: string;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      requiredClaims: ["sid"],
    });
    sid = payload.sid as string;
  } catch {
    return null;
  }
  const session = await prisma.session.findUnique({
    where: { id: sid },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return session.user;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
      if (payload.sid) {
        await prisma.session.deleteMany({ where: { id: payload.sid as string } });
      }
    } catch {
      // Expired or forged token: nothing to invalidate.
    }
  }
}
