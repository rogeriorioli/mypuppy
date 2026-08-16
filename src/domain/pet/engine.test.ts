import { describe, expect, it } from "vitest";
import {
  advancePersonality,
  advanceState,
  applyActionEffects,
  calculatePetState,
  canPerformAction,
  clamp,
  createPetSnapshot,
  detectCrossedEvents,
  dominantTrait,
  EVENT_CONDITIONS,
  getCooldownRemainingMs,
  getPetMood,
  HOUR_MS,
  INITIAL_STATE,
  MINUTE_MS,
  performAction,
  PET_BALANCE,
  processTime,
  processVisit,
  STARTING_PERSONALITY,
  type PetAction,
  type PetSnapshot,
  type PetState,
} from "@/domain/pet/engine";

const NOW = new Date("2026-08-15T12:00:00Z").getTime();

function snapshot(overrides: Partial<PetSnapshot> = {}): PetSnapshot {
  return { ...createPetSnapshot("caramelo", NOW), ...overrides };
}

function state(overrides: Partial<PetState> = {}): PetState {
  return { ...INITIAL_STATE, ...overrides };
}

describe("clamp", () => {
  it("constrains values to 0-100", () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(55.678)).toBe(55.7);
  });
});

describe("calculatePetState (decay)", () => {
  it("decays all metrics over time", () => {
    const next = calculatePetState(INITIAL_STATE, 1);
    expect(next.hunger).toBeGreaterThan(INITIAL_STATE.hunger);
    expect(next.happiness).toBeLessThan(INITIAL_STATE.happiness);
    expect(next.energy).toBeLessThan(INITIAL_STATE.energy);
    expect(next.affection).toBeLessThan(INITIAL_STATE.affection);
    expect(next.hygiene).toBeLessThan(INITIAL_STATE.hygiene);
    expect(next.walkNeed).toBeGreaterThan(INITIAL_STATE.walkNeed);
  });

  it("clamps decay to the 0-100 range", () => {
    const exhausted = state({ hunger: 99, happiness: 1, energy: 20, affection: 1, hygiene: 1, walkNeed: 99 });
    const next = calculatePetState(exhausted, 100);
    expect(next.hunger).toBeLessThanOrEqual(100);
    expect(next.happiness).toBeGreaterThanOrEqual(0);
    expect(next.affection).toBeGreaterThanOrEqual(0);
    expect(next.hygiene).toBeGreaterThanOrEqual(0);
    expect(next.walkNeed).toBeLessThanOrEqual(100);
  });

  it("is a no-op with zero or negative elapsed time", () => {
    expect(calculatePetState(INITIAL_STATE, 0)).toEqual(INITIAL_STATE);
    expect(calculatePetState(INITIAL_STATE, -3)).toEqual(INITIAL_STATE);
  });
});

describe("advanceState (sleep cycle)", () => {
  it("recovers energy while sleeping and decays needs slowly", () => {
    const result = advanceState(state({ energy: 0 }), 5, true);
    expect(result.state.energy).toBeGreaterThan(0);
    expect(result.state.happiness).toBe(INITIAL_STATE.happiness);
    expect(result.state.energy).toBeLessThanOrEqual(100);
  });

  it("falls asleep when energy is depleted and wakes when rested", () => {
    const nearlyEmpty = state({ energy: 0.4, happiness: 80 });
    const result = advanceState(nearlyEmpty, 24, false);
    expect(result.enteredSleep).toBe(true);
    expect(result.sleeping).toBe(false);
    expect(result.state.energy).toBeGreaterThan(25);
  });

  it("stays asleep if there is not enough time to wake", () => {
    const result = advanceState(state({ energy: 0 }), 1, true);
    expect(result.sleeping).toBe(true);
    expect(result.state.energy).toBeLessThan(PET_BALANCE.sleep.wakeAt);
  });
});

describe("actions", () => {
  it("applies deterministic effects within range", () => {
    const fed = applyActionEffects(state({ hunger: 50 }), "FEED");
    expect(fed.hunger).toBeLessThan(50);

    const walked = applyActionEffects(state({ walkNeed: 50 }), "WALK");
    expect(walked.walkNeed).toBeLessThan(50);

    const cleaned = applyActionEffects(state({ hygiene: 40 }), "CLEAN");
    expect(cleaned.hygiene).toBeGreaterThan(40);
  });

  it("never produces out-of-range values", () => {
    const actions: PetAction[] = ["FEED", "PLAY", "WALK", "CAFUNE", "CLEAN"];
    for (const action of actions) {
      const next = applyActionEffects(state({ hunger: 100, happiness: 0, walkNeed: 100, hygiene: 0 }), action);
      for (const value of Object.values(next)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("cooldowns", () => {
  it("blocks actions inside the cooldown window", () => {
    const lastActionAt = { FEED: NOW };
    expect(canPerformAction("FEED", lastActionAt, NOW + 1 * MINUTE_MS)).toBe(false);
    expect(canPerformAction("FEED", lastActionAt, NOW + 19 * MINUTE_MS)).toBe(false);
    expect(canPerformAction("FEED", lastActionAt, NOW + 21 * MINUTE_MS)).toBe(true);
    expect(canPerformAction("PLAY", lastActionAt, NOW)).toBe(true);
  });

  it("reports remaining cooldown milliseconds", () => {
    const lastActionAt = { PLAY: NOW };
    const remaining = getCooldownRemainingMs("PLAY", lastActionAt, NOW + 1 * MINUTE_MS);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(PET_BALANCE.cooldownMinutes.PLAY * MINUTE_MS);
  });
});

describe("threshold crossing", () => {
  it("emits PET_HUNGRY only when crossing the threshold", () => {
    const before = state({ hunger: 70 });
    const after = state({ hunger: 76 });
    const events = detectCrossedEvents(before, after, { sleeping: false }, { sleeping: false }, {}, NOW);
    expect(events).toContain("PET_HUNGRY");
  });

  it("does not repeat the same event while above the threshold", () => {
    const before = state({ hunger: 76 });
    const after = state({ hunger: 78 });
    const history: PetSnapshot["eventHistory"] = { PET_HUNGRY: NOW - 1 * HOUR_MS };
    const events = detectCrossedEvents(before, after, { sleeping: false }, { sleeping: false }, history, NOW);
    expect(events).not.toContain("PET_HUNGRY");
  });

  it("re-arms after the state leaves the threshold zone", () => {
    const before = state({ hunger: 40 });
    const after = state({ hunger: 76 });
    const history: PetSnapshot["eventHistory"] = { PET_HUNGRY: NOW - 10 * HOUR_MS };
    const events = detectCrossedEvents(before, after, { sleeping: false }, { sleeping: false }, history, NOW);
    expect(events).toContain("PET_HUNGRY");
  });

  it("respects per-event cooldowns", () => {
    const before = state({ hunger: 40 });
    const after = state({ hunger: 76 });
    const history: PetSnapshot["eventHistory"] = { PET_HUNGRY: NOW - 1 * HOUR_MS };
    const events = detectCrossedEvents(before, after, { sleeping: false }, { sleeping: false }, history, NOW);
    expect(events).not.toContain("PET_HUNGRY");
  });
});

describe("personality progression", () => {
  it("increases the trait matching the action", () => {
    const before = STARTING_PERSONALITY.caramelo;
    const after = advancePersonality(before, "PLAY");
    expect(after.PLAYFUL).toBeGreaterThan(before.PLAYFUL);
    expect(after.ADVENTUROUS).toBe(before.ADVENTUROUS);
  });

  it("gains slow down as a trait approaches the ceiling", () => {
    const low = advancePersonality({ ...STARTING_PERSONALITY.caramelo, PLAYFUL: 10 }, "PLAY");
    const high = advancePersonality({ ...STARTING_PERSONALITY.caramelo, PLAYFUL: 90 }, "PLAY");
    expect(low.PLAYFUL - 10).toBeGreaterThan(high.PLAYFUL - 90);
  });

  it("identifies the dominant trait", () => {
    expect(dominantTrait(STARTING_PERSONALITY.malhadinho)).toBe("PLAYFUL");
    expect(dominantTrait(STARTING_PERSONALITY.fiapo)).toBe("ATTACHED");
  });
});

describe("processTime and absence handling", () => {
  it("never punishes the pet for a long absence", () => {
    const longGone = { ...snapshot(), state: state(), lastCalculatedAt: NOW - 72 * HOUR_MS, lastVisitAt: NOW - 72 * HOUR_MS };
    const result = processVisit(longGone, NOW);
    expect(result.state.happiness).toBeGreaterThanOrEqual(0);
    expect(result.newEvents).toContain("PET_OWNER_RETURNED");
  });

  it("fires PET_MISSES_OWNER after a long absence", () => {
    const longGone = { ...snapshot(), lastCalculatedAt: NOW - 20 * HOUR_MS, lastVisitAt: NOW - 20 * HOUR_MS, state: state({ energy: 100 }) };
    const result = processTime(longGone, NOW);
    expect(result.newEvents).toContain("PET_MISSES_OWNER");
  });

  it("does not fire PET_OWNER_RETURNED on a quick visit", () => {
    const quick = { ...snapshot(), lastCalculatedAt: NOW - 1 * HOUR_MS, lastVisitAt: NOW - 1 * HOUR_MS };
    const result = processVisit(quick, NOW + 30 * MINUTE_MS);
    expect(result.newEvents).not.toContain("PET_OWNER_RETURNED");
  });
});

describe("performAction", () => {
  it("succeeds and advances state", () => {
    const result = performAction(snapshot(), "FEED", NOW + 1 * HOUR_MS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.hunger).toBeLessThan(INITIAL_STATE.hunger + PET_BALANCE.decayPerHour.hunger);
      expect(result.snapshot.lastActionAt.FEED).toBe(NOW + 1 * HOUR_MS);
    }
  });

  it("rejects actions on cooldown with a retry hint", () => {
    const withFeed = { ...snapshot(), lastActionAt: { FEED: NOW } };
    const result = performAction(withFeed, "FEED", NOW + 5 * MINUTE_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ON_COOLDOWN");
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("rejects tiring actions when the pet is sleeping", () => {
    const asleep = { ...snapshot(), sleeping: true, state: state({ energy: 5 }) };
    const result = performAction(asleep, "PLAY", NOW + 1 * HOUR_MS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SLEEPING");
  });
});

describe("events derive from deterministic conditions", () => {
  it("maps hunger thresholds", () => {
    expect(EVENT_CONDITIONS.PET_HUNGRY(state({ hunger: 76 }), { sleeping: false })).toBe(true);
    expect(EVENT_CONDITIONS.PET_HUNGRY(state({ hunger: 30 }), { sleeping: false })).toBe(false);
    expect(EVENT_CONDITIONS.PET_VERY_HUNGRY(state({ hunger: 92 }), { sleeping: false })).toBe(true);
  });

  it("maps mood from state", () => {
    expect(getPetMood(state({ energy: 5 }), false)).toBe("sleepy");
    expect(getPetMood(state({ hunger: 80, energy: 60 }), false)).toBe("hungry");
    expect(getPetMood(state({ happiness: 95, energy: 60 }), false)).toBe("excited");
    expect(getPetMood(state(), true)).toBe("sleeping");
  });
});
