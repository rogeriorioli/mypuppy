import "server-only";
import type { PetEvent, PetState, PetPersonality } from "@/domain/pet/engine";
import { dominantTrait, type PetArchetype, type PetTrait } from "@/domain/pet/engine";
import { prisma } from "@/lib/db";
import { isPushConfigured } from "@/lib/env";
import { getFallbackReaction, getPetReactionForContext } from "@/services/reactions";
import { EVENT_NOTIFICATION_COOLDOWN_MS } from "@/services/notification-policy";

/**
 * Web Push delivery layer. Domain logic decides which events are eligible to
 * notify; this layer only delivers already-approved events to authenticated
 * users' active subscriptions. It never decides game state.
 */

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

let webPushClient: typeof import("web-push") | null = null;

async function getWebPush() {
  if (webPushClient) return webPushClient;
  const mod = await import("web-push");
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) return null;
  mod.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:dev@dogday.local", vapidPublicKey, vapidPrivateKey);
  webPushClient = mod;
  return mod;
}

const NOTIFIABLE_EVENTS: PetEvent[] = [
  "PET_HUNGRY",
  "PET_VERY_HUNGRY",
  "PET_WANTS_WALK",
  "PET_NEEDS_ATTENTION",
  "PET_MISSES_OWNER",
  "PET_OWNER_RETURNED",
];

/**
 * Sends a push for each eligible event, respecting notification cooldown and
 * user preference. Removes/deactivates subscriptions the push provider marks
 * as permanently gone. Transient failures are logged but not fatal.
 */
export async function deliverEventNotifications(
  userId: string,
  petId: string,
  petName: string,
  events: PetEvent[],
  state: PetState,
  personality: PetPersonality,
): Promise<void> {
  const eligible = events.filter((event) => NOTIFIABLE_EVENTS.includes(event));
  if (eligible.length === 0) return;

  const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (prefs && !prefs.enabled) return;

  const pet = await prisma.pet.findUnique({ where: { id: petId } });
  const archetype = (pet?.archetype ?? "caramelo") as PetArchetype;
  const topTrait: PetTrait = dominantTrait(personality);

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, active: true },
  });
  const webpush = isPushConfigured() ? await getWebPush() : null;

  for (const event of eligible) {
    const allowed = await notificationAllowed(petId, event);
    if (!allowed) continue;

    let body: string;
    try {
      const reaction = await getPetReactionForContext({
        petId,
        petName,
        archetype,
        state,
        dominantTrait: topTrait,
        topTraits: [topTrait],
        trigger: { kind: "event", event },
      });
      body = reaction.notification;
    } catch {
      body = getFallbackReaction({ kind: "event", event }).notification;
    }

    const payload: PushPayload = { title: "MyPuppy", body, url: "/pet" };
    const payloadJson = JSON.stringify(payload);

    await prisma.appNotification.create({
      data: { userId, petId, event, title: payload.title, body: payload.body, url: payload.url },
    });

    if (!webpush || subscriptions.length === 0) continue;

    const removals: string[] = [];
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadJson,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            removals.push(sub.id);
          } else {
            console.error("[push] send failed:", error instanceof Error ? error.message : error);
          }
        }
      }),
    );

    if (removals.length > 0) {
      await prisma.pushSubscription.updateMany({ where: { id: { in: removals } }, data: { active: false } });
    }

    await prisma.petEventRecord.create({
      data: { petId, event: `${event}_NOTIFIED` },
    });
  }
}

/** Sends a manually requested test notification to one user's active devices. */
export async function sendTestPushNotification(userId: string, body: string = "Your MyPuppy test notification arrived. 🐾"): Promise<{ sent: number; removed: number }> {
  if (!isPushConfigured()) return { sent: 0, removed: 0 };
  const webpush = await getWebPush();
  if (!webpush) return { sent: 0, removed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId, active: true } });
  let sent = 0;
  let removed = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({ title: "MyPuppy", body, url: "/pet" }),
      );
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { active: false } });
        removed += 1;
      } else {
        console.error("[push] test send failed:", error instanceof Error ? error.message : error);
      }
    }
  }
  return { sent, removed };
}

async function notificationAllowed(petId: string, event: PetEvent): Promise<boolean> {
  const marker = `${event}_NOTIFIED`;
  const last = await prisma.petEventRecord.findFirst({
    where: { petId, event: marker },
    orderBy: { createdAt: "desc" },
  });
  if (!last) return true;
  return Date.now() - last.createdAt.getTime() >= EVENT_NOTIFICATION_COOLDOWN_MS;
}
