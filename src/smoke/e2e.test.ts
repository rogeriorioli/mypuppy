import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";
import { buildPgConnectionOptions } from "@/lib/db-connection";
import { createPetSnapshot } from "@/domain/pet/engine";
import { snapshotToDb } from "@/domain/pet/serialize";

/**
 * End-to-end smoke test: requires a running production server (SMOKE_BASE)
 * and a reachable database (DATABASE_URL). Skipped otherwise, so
 * `npm test` stays hermetic. Run with:
 *
 *   SMOKE_BASE=http://localhost:3100 npx vitest run src/smoke/e2e.test.ts
 */

const BASE = process.env.SMOKE_BASE ?? "";

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  return new PrismaClient({ adapter: new PrismaPg(buildPgConnectionOptions(url)) });
}

describe.skipIf(!BASE)("end-to-end smoke", () => {
  let prisma: PrismaClient;
  let userId: string;
  let petId: string;
  let cookie: string;
  const email = `smoke_${Date.now()}@dogday.dev`;

  beforeAll(async () => {
    prisma = createPrisma();

    const user = await prisma.user.create({
      data: { email, name: "Smoke", passwordHash: "not-used" },
    });
    userId = user.id;

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const session = await prisma.session.create({ data: { userId, expiresAt } });
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
    const token = await new SignJWT({ sid: session.id, uid: userId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(expiresAt)
      .sign(secret);
    cookie = `dogday_session=${token}`;

    const snapshot = createPetSnapshot("caramelo", Date.now());
    const pet = await prisma.pet.create({
      data: {
        userId,
        archetype: "caramelo",
        name: "Test Caramelo",
        active: true,
        state: { create: snapshotToDb(snapshot) },
      },
    });
    petId = pet.id;
  }, 30000);

  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("redirects unauthenticated /pet to /signin", async () => {
    const response = await fetch(`${BASE}/pet`, { redirect: "manual" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/signin");
  });

  it("lets authenticated users reach Pet Home", async () => {
    const response = await fetch(`${BASE}/pet`, { redirect: "manual", headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Test Caramelo");
  });

  it("returns 401 on /api/pet without a session", async () => {
    const response = await fetch(`${BASE}/api/pet?petId=${petId}`);
    expect(response.status).toBe(401);
  });

  it("returns the current pet state over the API", async () => {
    const response = await fetch(`${BASE}/api/pet?petId=${petId}`, { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe("Test Caramelo");
    expect(typeof body.state.hunger).toBe("number");
  });

  it("blocks access to another user's pet", async () => {
    const other = await prisma.user.create({
      data: { email: `other_${Date.now()}@dogday.dev`, name: "Other", passwordHash: "x" },
    });
    const pet = await prisma.pet.create({
      data: { userId: other.id, archetype: "fiapo", name: "Foreign", active: true, state: { create: snapshotToDb(createPetSnapshot("fiapo", Date.now())) } },
    });
    const response = await fetch(`${BASE}/api/pet?petId=${pet.id}`, { headers: { Cookie: cookie } });
    expect(response.status).toBe(404);
    await prisma.user.delete({ where: { id: other.id } });
  });

  it("performs an action server-side and enforces the cooldown", async () => {
    const first = await fetch(`${BASE}/api/pet`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ petId, action: "FEED" }),
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.ok).toBe(true);
    expect(typeof firstBody.reaction).toBe("string");
    expect(firstBody.reaction.length).toBeGreaterThan(0);

    const second = await fetch(`${BASE}/api/pet`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ petId, action: "FEED" }),
    });
    expect(second.status).toBe(409);
    const secondBody = await second.json();
    expect(secondBody.ok).toBe(false);
    expect(secondBody.reason).toBe("ON_COOLDOWN");
    expect(secondBody.retryAfterMs).toBeGreaterThan(0);

    const memory = await prisma.petMemory.findFirst({ where: { petId }, orderBy: { createdAt: "desc" } });
    expect(memory?.text).toContain("very important meal");

    const actionRecord = await prisma.petActionRecord.findFirst({ where: { petId, action: "FEED" } });
    expect(actionRecord).not.toBeNull();
  }, 30000);

  it("reports push availability honestly", async () => {
    const response = await fetch(`${BASE}/api/push/vapid-key`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.supported).toBe("boolean");
    if (!process.env.VAPID_PUBLIC_KEY) expect(body.supported).toBe(false);
  });

  it("rejects a subscription from an unauthenticated client", async () => {
    const response = await fetch(`${BASE}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://push.example.com/x", keys: { p256dh: "abcdefghij", auth: "abcd" } }),
    });
    expect(response.status).toBe(401);
  });
});
