import type { PetEvent, PetState, PetTrait, PetMood } from "@/domain/pet/engine";

/** Client-safe data transfer objects (no server-only imports). */

export interface PetHomeData {
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
  notifications: AppNotificationDto[];
  unreadNotifications: number;
}

export interface AppNotificationDto {
  id: string;
  event: string;
  title: string;
  body: string;
  url: string;
  readAt: string | null;
  createdAt: string;
  petName: string;
}

export interface PetActionResultData {
  ok: boolean;
  reason?: "ON_COOLDOWN" | "SLEEPING" | "TOO_TIRED";
  retryAfterMs?: number;
  state?: PetState;
  reaction?: string;
  emotion?: string;
  events?: PetEvent[];
  memory?: string;
}

export interface PetVisitData {
  state: PetState;
  sleeping: boolean;
  events: PetEvent[];
  reaction: string;
}
