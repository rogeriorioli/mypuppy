import "server-only";
import type { PetArchetype, PetState, PetTrait } from "@/domain/pet/engine";
import { isGeminiConfigured } from "@/lib/env";
import { prisma } from "@/lib/db";
import { Prisma } from "@generated/prisma/client";

type InputJsonValue = Prisma.InputJsonValue;
import {
  fallbackReactionFor,
  sanitizeReactionOutput,
  type PetReaction,
  type ReactionTrigger,
} from "@/domain/pet/reaction-copy";

export type { PetReaction, ReactionTrigger };

export interface ReactionContext {
  petId: string;
  petName: string;
  archetype: PetArchetype;
  state: PetState;
  dominantTrait: PetTrait;
  topTraits: PetTrait[];
  trigger: ReactionTrigger;
}

const EMOTIONS = ["happy", "excited", "hungry", "sleepy", "playful", "affectionate", "dramatic", "curious"] as const;

const MAX_REACTION = 140;

/** Gemini model is configurable; 2.5 Flash remains the documented default. */
function geminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

const ARCHETYPE_VOICES: Record<PetArchetype, string> = {
  caramelo: "warm, clever and adventurous",
  fiapo: "dramatic, affectionate and slightly chaotic",
  malhadinho: "playful, curious and investigative",
};

/** Cache key factors: archetype, trigger, dominant trait, emotion bucket. */
function cacheKeyFor(ctx: ReactionContext): string {
  const triggerPart = ctx.trigger.kind === "action" ? `a:${ctx.trigger.action}` : `e:${ctx.trigger.event}`;
  const emotion = fallbackReactionFor(ctx.trigger).emotion;
  return [ctx.archetype, triggerPart, ctx.dominantTrait.toLowerCase(), emotion].join("|");
}

function withGeminiSource(
  sanitized: NonNullable<ReturnType<typeof sanitizeReactionOutput>>,
): PetReaction {
  return { ...sanitized, source: "gemini" };
}

async function generateWithGemini(ctx: ReactionContext): Promise<PetReaction | null> {
  if (!isGeminiConfigured()) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const timeoutMs = 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { GoogleGenAI, Type } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const voice = ARCHETYPE_VOICES[ctx.archetype];
    const prompt = [
      `You are ${ctx.petName}, a Brazilian mixed-breed dog in a virtual pet game.`,
      `Voice: ${voice}. Current dominant trait: ${ctx.dominantTrait.toLowerCase().replace("_", " ")}.`,
      `State (0-100): hunger ${Math.round(ctx.state.hunger)}, happiness ${Math.round(ctx.state.happiness)}, energy ${Math.round(ctx.state.energy)}, affection ${Math.round(ctx.state.affection)}.`,
      ctx.trigger.kind === "action" ? `The owner just did: ${ctx.trigger.action}.` : `Domain event: ${ctx.trigger.event}.`,
      "Write a short, funny, affectionate reaction in English. Allowed Brazilian expressions: Cafuné, Rolê, Bagunça, Soneca, Caramelo. Use sparingly.",
      "Return strict JSON: {\"reaction\": string, \"notification\": string, \"emotion\": string}.",
      `emotion must be one of: ${EMOTIONS.join(", ")}.`,
      "Do not mention being an AI. Do not reveal numbers. Keep both fields under 120 characters.",
    ].join("\n");

    const response = await ai.models.generateContent({
      model: geminiModel(),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reaction: { type: Type.STRING },
            notification: { type: Type.STRING },
            emotion: { type: Type.STRING, enum: [...EMOTIONS] },
          },
          required: ["reaction", "notification", "emotion"],
        },
        abortSignal: controller.signal,
      },
    });
    if (!response.text) return null;
    const parsed = JSON.parse(response.text);
    const validated = sanitizeReactionOutput(parsed);
    return validated ? withGeminiSource(validated) : null;
  } catch (error) {
    console.error("[reactions] Gemini generation failed:", error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns a pet reaction for the given context. Uses Gemini 2.5 Flash when
 * configured, with aggressive caching and a deterministic fallback. The
 * product must never fail or expose AI errors to the user because of this
 * layer, and the returned copy never mutates game state.
 */
export async function getPetReactionForContext(ctx: ReactionContext): Promise<PetReaction> {
  const fallback = fallbackReactionFor(ctx.trigger);
  const key = cacheKeyFor(ctx);

  try {
    const cached = await prisma.reactionCache.findUnique({ where: { cacheKey: key } });
    if (cached) {
      const reuse = sanitizeReactionOutput(cached.reaction);
      if (reuse) return { ...reuse, source: "cache" };
    }
  } catch (error) {
    console.error("[reactions] cache read failed:", error instanceof Error ? error.message : error);
  }

  const generated = await generateWithGemini(ctx);
  if (!generated) return fallback;

  try {
    const stored = {
      reaction: generated.reaction.slice(0, MAX_REACTION),
      notification: generated.notification,
      emotion: generated.emotion,
    };
    await prisma.reactionCache.upsert({
      where: { cacheKey: key },
      update: { reaction: stored as unknown as InputJsonValue },
      create: { cacheKey: key, reaction: stored as unknown as InputJsonValue },
    });
  } catch (error) {
    console.error("[reactions] cache write failed:", error instanceof Error ? error.message : error);
  }

  return generated;
}

/** Deterministic fallback reaction, used when AI is unavailable. */
export function getFallbackReaction(trigger: ReactionTrigger): PetReaction {
  return fallbackReactionFor(trigger);
}
