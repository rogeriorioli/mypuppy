import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
});

/**
 * Stores a PushSubscription against the authenticated user. Supports
 * multiple devices per user; replaces a subscription with the same endpoint.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.pushSubscription.findUnique({ where: { endpoint } });
      if (existing) {
        await tx.pushSubscription.update({
          where: { endpoint },
          data: { p256dh: keys.p256dh, auth: keys.auth, active: true, userId: user.id },
        });
      } else {
        await tx.pushSubscription.create({
          data: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, active: true },
        });
      }
      await tx.notificationPreference.upsert({
        where: { userId: user.id },
        update: { enabled: true },
        create: { userId: user.id, enabled: true },
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[push] subscribe failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

/** Removes the current device's subscription. */
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const endpointSchema = z.object({ endpoint: z.string().url().max(2048) });
  const parsed = endpointSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Invalid endpoint" }, { status: 400 });

  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: user.id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[push] unsubscribe failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
