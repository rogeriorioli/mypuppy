import type { PetEvent } from "@/domain/pet/engine";

/**
 * Deterministic reaction copy and output validation. Pure module — no
 * server-only imports — so it can be reused by the backend and covered by
 * isolated tests. Gemini output is always treated as untrusted data and
 * passed through `sanitizeReactionOutput` before use.
 */

export type ReactionTrigger =
  | { kind: "action"; action: string }
  | { kind: "event"; event: PetEvent };

export interface PetReaction {
  reaction: string;
  notification: string;
  emotion: string;
  source: "gemini" | "fallback" | "cache";
}

export const EMOTIONS = [
  "happy",
  "excited",
  "hungry",
  "sleepy",
  "playful",
  "affectionate",
  "dramatic",
  "curious",
] as const;

const MAX_REACTION = 140;
const MAX_NOTIFICATION = 100;

const ACTION_FALLBACK_COPY: Record<string, Omit<PetReaction, "source">> = {
  FEED: {
    reaction: "The bowl has been inspected. Justice has been served.",
    notification: "Mealtime complete. The bowl is spotless.",
    emotion: "happy",
  },
  PLAY: {
    reaction: "A tiny burst of chaos! Exactly the right amount of fun.",
    notification: "Play session: 100% Bagunça.",
    emotion: "playful",
  },
  WALK: {
    reaction: "The leash is out. The rolê was a complete success.",
    notification: "Rolê complete. Tail status: wagging.",
    emotion: "excited",
  },
  CAFUNE: {
    reaction: "Eyes closed. Tail wagging. Cafuné approved.",
    notification: "Cafuné received and deeply appreciated.",
    emotion: "affectionate",
  },
  CLEAN: {
    reaction: "Bath complete. Now 40% floofier.",
    notification: "Bath time done. Squeaky clean achieved.",
    emotion: "happy",
  },
};

export const EVENT_FALLBACK_COPY: Record<PetEvent, Omit<PetReaction, "source">> = {
  PET_HUNGRY: {
    reaction: "Someone has been staring at the food bowl for a while.",
    notification: "The food bowl is looking suspiciously empty.",
    emotion: "hungry",
  },
  PET_VERY_HUNGRY: {
    reaction: "The food bowl situation has become urgent.",
    notification: "Dinner time. This is not a drill.",
    emotion: "hungry",
  },
  PET_WANTS_WALK: {
    reaction: "The leash has appeared in the middle of the room. Suspicious.",
    notification: "Your dog just brought you the leash.",
    emotion: "excited",
  },
  PET_NEEDS_ATTENTION: {
    reaction: "A gentle nose boop has been deployed.",
    notification: "A little attention would go a long way today.",
    emotion: "affectionate",
  },
  PET_BORED: {
    reaction: "Counting ceiling tiles. Send entertainment.",
    notification: "Boredom levels rising. Play recommended.",
    emotion: "dramatic",
  },
  PET_SLEEPY: {
    reaction: "A very necessary Soneca is approaching.",
    notification: "Nap mode is loading...",
    emotion: "sleepy",
  },
  PET_SLEEPING: {
    reaction: "Zzz... dreaming about treats.",
    notification: "Shhh. The Soneca has begun.",
    emotion: "sleepy",
  },
  PET_HAPPY: {
    reaction: "Tail operating at maximum capacity.",
    notification: "Someone is having an excellent day.",
    emotion: "happy",
  },
  PET_EXCITED: {
    reaction: "Zoomies imminent. Clear the area.",
    notification: "Zoomies detected. Hold on to your socks.",
    emotion: "excited",
  },
  PET_CLEAN_FRESH: {
    reaction: "Smells like victory and lavender shampoo.",
    notification: "Fresh and clean and ready for cuddles.",
    emotion: "happy",
  },
  PET_MISSES_OWNER: {
    reaction: "Waiting by the door. Still the goodest employee.",
    notification: "Your dog misses you a little. No rush though.",
    emotion: "affectionate",
  },
  PET_OWNER_RETURNED: {
    reaction: "Full-body wiggle. The reunion is official.",
    notification: "Welcome back! Someone is very happy to see you.",
    emotion: "excited",
  },
};

/** Deterministic fallback reaction used whenever AI is unavailable. */
export function fallbackReactionFor(trigger: ReactionTrigger): PetReaction {
  if (trigger.kind === "action") {
    const copy = ACTION_FALLBACK_COPY[trigger.action] ?? ACTION_FALLBACK_COPY.CAFUNE;
    return { ...copy, source: "fallback" };
  }
  const copy = EVENT_FALLBACK_COPY[trigger.event] ?? EVENT_FALLBACK_COPY.PET_NEEDS_ATTENTION;
  return { ...copy, source: "fallback" };
}

/**
 * Validates untrusted model output. Returns null when the payload does not
 * match the expected shape; callers must fall back to deterministic copy.
 */
export function sanitizeReactionOutput(raw: unknown): Omit<PetReaction, "source"> | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.reaction !== "string" ||
    typeof value.notification !== "string" ||
    typeof value.emotion !== "string"
  ) {
    return null;
  }
  const reaction = value.reaction.trim().slice(0, MAX_REACTION);
  const notification = value.notification.trim().slice(0, MAX_NOTIFICATION);
  const emotion = (EMOTIONS as readonly string[]).includes(value.emotion) ? value.emotion : "happy";
  if (!reaction || !notification) return null;
  return { reaction, notification, emotion };
}
