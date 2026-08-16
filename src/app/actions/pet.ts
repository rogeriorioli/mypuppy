"use server";

import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { createFirstPet, performPetAction, processPetVisit } from "@/services/pet-service";
import type { ActionResultDto, VisitResultDto } from "@/services/pet-service";

const petActionSchema = z.object({
  petId: z.string().min(1),
  action: z.enum(["FEED", "PLAY", "WALK", "CAFUNE", "CLEAN"]),
});

export interface PetFormResult {
  ok: boolean;
  errors?: Record<string, string[]>;
}

/**
 * Server-side action pipeline: authenticate, load, calculate, validate
 * cooldown, apply deterministic effects, persist, generate reaction. The UI
 * only renders the result.
 */
export async function doPetAction(petId: string, action: string): Promise<ActionResultDto> {
  const user = await requireSessionUser().catch(() => null);
  if (!user) return { ok: false, reason: "SLEEPING" };

  const parsed = petActionSchema.safeParse({ petId, action });
  if (!parsed.success) return { ok: false, reason: "SLEEPING" };

  try {
    return await performPetAction(user.id, parsed.data.petId, parsed.data.action);
  } catch (error) {
    console.error("[pet] action failed:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "SLEEPING" };
  }
}

export async function visitPet(petId: string): Promise<VisitResultDto | null> {
  const user = await requireSessionUser().catch(() => null);
  if (!user) return null;
  try {
    return await processPetVisit(user.id, petId);
  } catch (error) {
    console.error("[pet] visit failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

const createPetSchema = z.object({
  archetype: z.enum(["caramelo", "fiapo", "malhadinho"]),
  name: z.string().trim().min(1, "Choose a name.").max(18, "Name must be 18 characters or fewer."),
});

export interface CreatePetResult {
  ok: boolean;
  petId?: string;
  errors?: Record<string, string[]>;
}

export async function createPetAction(_previous: CreatePetResult | undefined, formData: FormData): Promise<CreatePetResult> {
  const user = await requireSessionUser().catch(() => null);
  if (!user) return { ok: false, errors: { form: ["Sign in first."] } };

  const parsed = createPetSchema.safeParse({
    archetype: formData.get("archetype"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (errors[key] ??= []).push(issue.message);
    }
    return { ok: false, errors };
  }

  try {
    const { petId } = await createFirstPet(user.id, parsed.data.archetype, parsed.data.name);
    return { ok: true, petId };
  } catch (error) {
    console.error("[pet] create failed:", error instanceof Error ? error.message : error);
    return { ok: false, errors: { form: ["Something went wrong. Try again."] } };
  }
}
