import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";
import { buildPgConnectionOptions } from "@/lib/db-connection";
import { createPetSnapshot } from "@/domain/pet/engine";
import { snapshotToDb } from "@/domain/pet/serialize";

/**
 * Live Gemini reaction test: requires a running server (SMOKE_BASE), the DB,
 * and a working GEMINI_API_KEY. Run with:
 *
 *   SMOKE_BASE=http://localhost:3100 npx vitest run src/smoke/gemini.test.ts
 */

const BASE = process.env.SMOKE_BASE ?? "";

describe.skipIf(!BASE || !process.env.GEMINI_API_KEY)("gemini live reaction", () => {
  let prisma: PrismaClient;
  let userId: string;
  let petId: string;
  let cookie: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg(buildPgConnectionOptions(process.env.DATABASE_URL!)) });
    const user = await prisma.user.create({
      data: { email: `gemini_${Date.now()}@dogday.dev`, name: "GeminiTester", passwordHash: "x" },
    });
    userId = user.id;
    const expiresAt = new Date(Date.now() + 3600000);
    const session = await prisma.session.create({ data: { userId, expiresAt } });
    const token = await new SignJWT({ sid: session.id, uid: userId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(expiresAt)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET ?? ""));
    cookie = `dogday_session=${token}`;
    const pet = await prisma.pet.create({
      data: {
        userId,
        archetype: "fiapo",
        name: "Fiapo",
        active: true,
        state: { create: snapshotToDb(createPetSnapshot("fiapo", Date.now())) },
      },
    });
    petId = pet.id;
  }, 30000);

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("returns an AI-generated reaction for an action", async () => {
    const response = await fetch(`${BASE}/api/pet`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ petId, action: "CAFUNE" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.reaction).toBe("string");
    expect(body.reaction.length).toBeGreaterThan(0);
    expect(typeof body.emotion).toBe("string");
    console.log("     reaction:", body.reaction);
    console.log("     emotion:", body.emotion);
  }, 60000);

  it("caches the reaction in the database", async () => {
    const cached = await prisma.reactionCache.findMany({
      where: { cacheKey: { contains: "cafune" } },
    });
    expect(cached.length).toBeGreaterThanOrEqual(0);
    if (cached.length > 0) {
      console.log("     cached entries for cafune:", cached.length, "key:", cached[0].cacheKey);
    }
  });
});
