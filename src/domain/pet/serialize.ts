import type {
  EventHistory,
  LastActionAt,
  PetSnapshot,
  PetState,
} from "@/domain/pet/engine";
import { Prisma } from "@generated/prisma/client";

type InputJsonValue = Prisma.InputJsonValue;

/**
 * Serialization between the engine's in-memory snapshot and persisted
 * columns. The engine keeps plain numbers; JSON columns keep sparse
 * timestamp maps.
 */

export function snapshotToDb(snapshot: PetSnapshot) {
  return {
    hunger: snapshot.state.hunger,
    happiness: snapshot.state.happiness,
    energy: snapshot.state.energy,
    affection: snapshot.state.affection,
    hygiene: snapshot.state.hygiene,
    walkNeed: snapshot.state.walkNeed,
    sleeping: snapshot.sleeping,
    lastCalculatedAt: new Date(snapshot.lastCalculatedAt),
    lastVisitAt: new Date(snapshot.lastVisitAt),
    lastActionAt: snapshot.lastActionAt as unknown as InputJsonValue,
    eventHistory: snapshot.eventHistory as unknown as InputJsonValue,
  };
}

export function dbToSnapshot(
  row: {
    hunger: number;
    happiness: number;
    energy: number;
    affection: number;
    hygiene: number;
    walkNeed: number;
    sleeping: boolean;
    lastCalculatedAt: Date;
    lastVisitAt: Date;
    lastActionAt: unknown;
    eventHistory: unknown;
  },
  createdAt: number,
): PetSnapshot {
  const state: PetState = {
    hunger: row.hunger,
    happiness: row.happiness,
    energy: row.energy,
    affection: row.affection,
    hygiene: row.hygiene,
    walkNeed: row.walkNeed,
  };
  return {
    state,
    sleeping: row.sleeping,
    lastCalculatedAt: row.lastCalculatedAt.getTime(),
    lastVisitAt: row.lastVisitAt.getTime(),
    lastActionAt: (row.lastActionAt as LastActionAt) ?? {},
    eventHistory: (row.eventHistory as EventHistory) ?? {},
    createdAt,
  };
}
