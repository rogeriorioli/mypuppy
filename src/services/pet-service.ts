import "server-only";
import { prisma } from "@/lib/db";
import {
  advancePersonality,
  applyActionEffects,
  createPetSnapshot,
  dominantTrait,
  EVENT_CONDITIONS,
  getPetMood,
  performAction,
  processTime,
  processVisit,
  topTraits,
  type EventHistory,
  type PetAction,
  type PetArchetype,
  type PetEvent,
  type PetMood,
  type PetPersonality,
  type PetSnapshot,
  type PetState,
  type PetTrait,
} from "@/domain/pet/engine";
import { dbToSnapshot, snapshotToDb } from "@/domain/pet/serialize";
import { getFallbackReaction, getPetReactionForContext, type ReactionTrigger } from "@/services/reactions";
import { deliverEventNotifications } from "@/services/notifications";

/**
 * Application layer for pet mechanics. All state mutation flows through
 * here: load persisted snapshot, apply deterministic engine rules, validate,
 * persist, then optionally generate a reaction and deliver notifications.
 * The UI never decides cooldowns or state changes.
 */

export interface ActionResultDto {
  ok: boolean;
  reason?: "ON_COOLDOWN" | "SLEEPING" | "TOO_TIRED";
  retryAfterMs?: number;
  state?: PetState;
  reaction?: string;
  emotion?: string;
  events?: PetEvent[];
  memory?: string;
}

const MEMORY_COPY: Record<PetAction, string> = {
  FEED: "was served a very important meal",
  PLAY: "started a little Bagunça",
  WALK: "went on a successful rolê",
  CAFUNE: "received excellent Cafuné",
  CLEAN: "got squeaky clean after a bath",
};

async function loadSnapshot(petId: string): Promise<{ snapshot: PetSnapshot; pet: { id: string; name: string; archetype: string } } | null> {
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    include: { state: true },
  });
  if (!pet || !pet.state) return null;
  return {
    snapshot: dbToSnapshot(pet.state, pet.createdAt.getTime()),
    pet: { id: pet.id, name: pet.name, archetype: pet.archetype },
  };
}

async function loadPersonality(petId: string): Promise<PetPersonality> {
  const counts = await prisma.petActionRecord.groupBy({
    by: ["action"],
    where: { petId },
    _count: { _all: true },
  });
  const countsByAction = Object.fromEntries(counts.map((c) => [c.action, c._count._all])) as Partial<
    Record<PetAction, number>
  >;
  const pet = await prisma.pet.findUnique({ where: { id: petId } });
  let personality: PetPersonality = { PLAYFUL: 0, ADVENTUROUS: 0, ATTACHED: 0, FOOD_MOTIVATED: 0, RELAXED: 0, CURIOUS: 0 };
  if (pet) {
    const starting: Record<string, PetPersonality> = {
      caramelo: { PLAYFUL: 28, ADVENTUROUS: 48, ATTACHED: 38, FOOD_MOTIVATED: 34, RELAXED: 24, CURIOUS: 32 },
      fiapo: { PLAYFUL: 36, ADVENTUROUS: 18, ATTACHED: 52, FOOD_MOTIVATED: 28, RELAXED: 42, CURIOUS: 30 },
      malhadinho: { PLAYFUL: 52, ADVENTUROUS: 34, ATTACHED: 24, FOOD_MOTIVATED: 22, RELAXED: 18, CURIOUS: 50 },
    };
    personality = starting[pet.archetype] ?? starting.caramelo;
  }
  const order: PetAction[] = ["PLAY", "WALK", "CAFUNE", "FEED", "CLEAN"];
  for (const action of order) {
    for (let i = 0; i < (countsByAction[action] ?? 0); i++) {
      personality = advancePersonality(personality, action);
    }
  }
  return personality;
}

export async function performPetAction(userId: string, petId: string, action: PetAction): Promise<ActionResultDto> {
  await assertPetOwnership(userId, petId);
  const loaded = await loadSnapshot(petId);
  if (!loaded) return { ok: false, reason: "SLEEPING" };

  const now = Date.now();
  const result = performAction(loaded.snapshot, action, now);
  if (!result.ok) {
    return { ok: false, reason: result.reason, retryAfterMs: result.retryAfterMs };
  }

  const memoryText = `${loaded.pet.name} ${MEMORY_COPY[action]}.`;

  await prisma.$transaction([
    prisma.petState.update({ where: { petId }, data: snapshotToDb(result.snapshot) }),
    prisma.petActionRecord.create({ data: { petId, action } }),
    prisma.petMemory.create({ data: { petId, text: memoryText } }),
    ...result.newEvents.map((event) => prisma.petEventRecord.create({ data: { petId, event } })),
  ]);

  const personality = await loadPersonality(petId);
  const reaction = await getPetReactionForContext({
    petId,
    petName: loaded.pet.name,
    archetype: loaded.pet.archetype as PetArchetype,
    state: result.state,
    dominantTrait: dominantTrait(personality),
    topTraits: topTraits(personality, 3).map((t) => t.trait),
    trigger: { kind: "action", action } satisfies ReactionTrigger,
  });

  void deliverEventNotifications(userId, petId, loaded.pet.name, result.newEvents, result.state, personality).catch(() => undefined);

  return {
    ok: true,
    state: result.state,
    events: result.newEvents,
    reaction: reaction.reaction,
    emotion: reaction.emotion,
    memory: memoryText,
  };
}

export interface VisitResultDto {
  state: PetState;
  sleeping: boolean;
  events: PetEvent[];
  reaction: string;
}

/** Advances time and applies the "owner returned" rules when the app opens. */
export async function processPetVisit(userId: string, petId: string): Promise<VisitResultDto | null> {
  await assertPetOwnership(userId, petId);
  const loaded = await loadSnapshot(petId);
  if (!loaded) return null;

  const now = Date.now();
  const result = processVisit(loaded.snapshot, now);
  await prisma.petState.update({ where: { petId }, data: snapshotToDb(result.snapshot) });
  if (result.newEvents.length > 0) {
    await prisma.petEventRecord.createMany({
      data: result.newEvents.map((event) => ({ petId, event })),
    });
  }

  const personality = await loadPersonality(petId);
  if (result.newEvents.length > 0) {
    const reaction = await getPetReactionForContext({
      petId,
      petName: loaded.pet.name,
      archetype: loaded.pet.archetype as PetArchetype,
      state: result.state,
      dominantTrait: dominantTrait(personality),
      topTraits: topTraits(personality, 3).map((t) => t.trait),
      trigger: { kind: "event", event: result.newEvents[0] } satisfies ReactionTrigger,
    });
    void deliverEventNotifications(userId, petId, loaded.pet.name, result.newEvents, result.state, personality).catch(() => undefined);
    return { state: result.state, sleeping: result.snapshot.sleeping, events: result.newEvents, reaction: reaction.reaction };
  }
  return { state: result.state, sleeping: result.snapshot.sleeping, events: [], reaction: "" };
}

export interface CurrentStateDto {
  state: PetState;
  sleeping: boolean;
  events: PetEvent[];
  name: string;
  archetype: string;
}

/** Read-only projection of the pet's current state (advances time, no visit). */
export async function getCurrentPetState(userId: string, petId: string): Promise<CurrentStateDto | null> {
  await assertPetOwnership(userId, petId);
  const loaded = await loadSnapshot(petId);
  if (!loaded) return null;
  const result = processTime(loaded.snapshot, Date.now());
  return {
    state: result.state,
    sleeping: result.snapshot.sleeping,
    events: activeEvents(result.snapshot.eventHistory, result.state, result.snapshot.sleeping),
    name: loaded.pet.name,
    archetype: loaded.pet.archetype,
  };
}

async function assertPetOwnership(userId: string, petId: string): Promise<void> {
  const pet = await prisma.pet.findFirst({ where: { id: petId, userId } });
  if (!pet) throw new Error("PET_NOT_FOUND");
}

export async function listMemories(userId: string, limit: number = 30): Promise<{ id: string; text: string; createdAt: Date }[]> {
  const pet = await prisma.pet.findFirst({ where: { userId, active: true } });
  if (!pet) return [];
  return prisma.petMemory.findMany({
    where: { petId: pet.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, text: true, createdAt: true },
  });
}

export async function createFirstPet(userId: string, archetype: PetArchetype, name: string): Promise<{ petId: string }> {
  const now = Date.now();
  const snapshot = createPetSnapshot(archetype, now);
  const pet = await prisma.$transaction(async (tx) => {
    await tx.pet.updateMany({ where: { userId, active: true }, data: { active: false } });
    const created = await tx.pet.create({
      data: {
        userId,
        archetype,
        name,
        active: true,
        state: { create: snapshotToDb(snapshot) },
      },
      include: { state: true },
    });
    return created;
  });
  return { petId: pet.id };
}

export interface PetHomeDataDto {
  petId: string;
  name: string;
  archetype: string;
  state: PetState;
  sleeping: boolean;
  events: PetEvent[];
  mood: PetMood;
  personality: { trait: PetTrait; value: number }[];
  dominantTrait: PetTrait;
  daysTogether: number;
  createdAt: string;
  memories: { id: string; text: string; createdAt: string }[];
  reaction: string;
}

/**
 * Server-rendered initial payload for the Pet Home screen. Opening Pet Home
 * counts as the owner visiting: applies elapsed time, the owner-returned
 * rules, and persists the result.
 */
export async function getPetHomeData(userId: string): Promise<PetHomeDataDto | null> {
  const pet = await prisma.pet.findFirst({
    where: { userId, active: true },
    include: { state: true },
  });
  if (!pet || !pet.state) return null;

  const snapshot = dbToSnapshot(pet.state, pet.createdAt.getTime());
  const now = Date.now();
  const timed = processVisit(snapshot, now);

  await prisma.petState.update({ where: { petId: pet.id }, data: snapshotToDb(timed.snapshot) });
  if (timed.newEvents.length > 0) {
    await prisma.petEventRecord.createMany({
      data: timed.newEvents.map((event) => ({ petId: pet.id, event })),
    });
  }

  const personality = await loadPersonality(pet.id);
  const memories = await prisma.petMemory.findMany({
    where: { petId: pet.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, text: true, createdAt: true },
  });

  let reaction = `Welcome back. ${pet.name} is here, and today is officially a good day.`;
  if (timed.newEvents.length > 0) {
    try {
      const generated = await getPetReactionForContext({
        petId: pet.id,
        petName: pet.name,
        archetype: pet.archetype as PetArchetype,
        state: timed.state,
        dominantTrait: dominantTrait(personality),
        topTraits: topTraits(personality, 3).map((t) => t.trait),
        trigger: { kind: "event", event: timed.newEvents[0] },
      });
      reaction = generated.reaction;
    } catch {
      reaction = getFallbackReaction({ kind: "event", event: timed.newEvents[0] }).reaction;
    }
    void deliverEventNotifications(userId, pet.id, pet.name, timed.newEvents, timed.state, personality).catch(() => undefined);
  }

  const daysTogether = Math.max(1, Math.floor((now - pet.createdAt.getTime()) / (24 * 60 * 60 * 1000)) + 1);

  return {
    petId: pet.id,
    name: pet.name,
    archetype: pet.archetype,
    state: timed.state,
    sleeping: timed.snapshot.sleeping,
    events: activeEvents(timed.snapshot.eventHistory, timed.state, timed.snapshot.sleeping),
    mood: getPetMood(timed.state, timed.snapshot.sleeping),
    personality: topTraits(personality, 6).map((t) => ({ trait: t.trait, value: Math.round(t.value) })),
    dominantTrait: dominantTrait(personality),
    daysTogether,
    createdAt: pet.createdAt.toISOString(),
    memories: memories.map((memory) => ({ id: memory.id, text: memory.text, createdAt: memory.createdAt.toISOString() })),
    reaction,
  };
}

/** Returns the events whose condition is currently true (for UI display). */
function activeEvents(eventHistory: EventHistory, state: PetState, sleeping: boolean): PetEvent[] {
  const active: PetEvent[] = [];
  for (const [event, condition] of Object.entries(EVENT_CONDITIONS) as [PetEvent, (state: PetState, snap: { sleeping: boolean }) => boolean][]) {
    if (condition(state, { sleeping })) active.push(event);
  }
  return active;
}

export { applyActionEffects };
