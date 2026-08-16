import { jwtVerify } from "jose";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) return null;
  return new TextEncoder().encode(value);
}

/**
 * Fast, dependency-free session signature check used by the proxy layer.
 * Does not touch the database — route and server actions re-validate the
 * full session (existence + expiry + ownership) server-side.
 */
export async function hasValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const key = secret();
  if (!key) return false;
  try {
    await jwtVerify(token, key, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export function sessionMaxAgeSeconds(): number {
  return SESSION_TTL_MS / 1000;
}
