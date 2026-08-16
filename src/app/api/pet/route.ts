import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { performPetAction, processPetVisit, getCurrentPetState } from "@/services/pet-service";
import type { PetAction } from "@/domain/pet/engine";

function isPetNotFound(error: unknown): boolean {
  return error instanceof Error && error.message === "PET_NOT_FOUND";
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const search = request.nextUrl.searchParams;
  const petId = search.get("petId");
  if (!petId) return Response.json({ error: "petId is required" }, { status: 400 });

  try {
    const state = await getCurrentPetState(user.id, petId);
    if (!state) return Response.json({ error: "Pet not found" }, { status: 404 });
    return Response.json(state);
  } catch (error) {
    if (isPetNotFound(error)) return Response.json({ error: "Pet not found" }, { status: 404 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

const bodySchema = z.object({
  petId: z.string().min(1),
  action: z.enum(["FEED", "PLAY", "WALK", "CAFUNE", "CLEAN"]).optional(),
  visit: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    if (parsed.data.visit) {
      const result = await processPetVisit(user.id, parsed.data.petId);
      if (!result) return Response.json({ error: "Pet not found" }, { status: 404 });
      return Response.json(result);
    }
    const result = await performPetAction(user.id, parsed.data.petId, parsed.data.action as PetAction);
    if (!result.ok) return Response.json(result, { status: 409 });
    return Response.json(result);
  } catch (error) {
    if (isPetNotFound(error)) return Response.json({ error: "Pet not found" }, { status: 404 });
    console.error("[api/pet] failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
