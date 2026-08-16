/**
 * MyPuppy — deterministic Virtual Pet Engine.
 *
 * Fundamental rules:
 * - AI (Gemini) NEVER controls game state. This module is the single source
 *   of truth for every state mutation.
 * - Pure functions only. Time is always received as an explicit timestamp
 *   argument; `Date.now()` is never read inside this module.
 * - All metric values are clamped to the 0-100 range.
 * - The pet never dies. Long absence means boredom, naps and missing the
 *   owner — never irreversible punishment.
 *
 * Metric semantics (0-100):
 * - hunger:     0 = just fed, 100 = starving. Rises with time.
 * - happiness:  0 = miserable, 100 = best day ever. Decays with time.
 * - energy:     0 = exhausted, 100 = fully rested. Decays while awake,
 *               recovers while sleeping.
 * - affection:  0 = distant, 100 = deeply bonded. Decays slowly with time.
 * - hygiene:    0 = needs a bath, 100 = squeaky clean. Decays with time.
 * - walkNeed:   0 = just walked, 100 = desperate for a Rolê. Rises with time.
 */

export type PetArchetype = "caramelo" | "fiapo" | "malhadinho"

export type PetAction = "FEED" | "PLAY" | "WALK" | "CAFUNE" | "CLEAN"

export type PetEvent =
  | "PET_HUNGRY"
  | "PET_VERY_HUNGRY"
  | "PET_WANTS_WALK"
  | "PET_NEEDS_ATTENTION"
  | "PET_BORED"
  | "PET_SLEEPY"
  | "PET_SLEEPING"
  | "PET_HAPPY"
  | "PET_EXCITED"
  | "PET_CLEAN_FRESH"
  | "PET_MISSES_OWNER"
  | "PET_OWNER_RETURNED"

export type PetTrait =
  | "PLAYFUL"
  | "ADVENTUROUS"
  | "ATTACHED"
  | "FOOD_MOTIVATED"
  | "RELAXED"
  | "CURIOUS"

export type PetMood =
  | "sleeping"
  | "sleepy"
  | "hungry"
  | "needs-walk"
  | "lonely"
  | "excited"
  | "happy"

export interface PetState {
  hunger: number
  happiness: number
  energy: number
  affection: number
  hygiene: number
  walkNeed: number
}

export type PetPersonality = Record<PetTrait, number>

export type EventHistory = Partial<Record<PetEvent, number>>

export type LastActionAt = Partial<Record<PetAction, number>>

/** Everything persisted about a pet between requests. */
export interface PetSnapshot {
  state: PetState
  /** Timestamp (ms) of the last state calculation. */
  lastCalculatedAt: number
  /** Timestamp (ms) of the last owner visit/interaction. */
  lastVisitAt: number
  lastActionAt: LastActionAt
  /** Last emission timestamp per event, used for threshold re-arming. */
  eventHistory: EventHistory
  /** Whether the pet was sleeping at `lastCalculatedAt`. */
  sleeping: boolean
  createdAt: number
}

export type ActionRejectReason = "ON_COOLDOWN" | "SLEEPING" | "TOO_TIRED"

export type ActionResult =
  | { ok: true; snapshot: PetSnapshot; state: PetState; newEvents: PetEvent[] }
  | { ok: false; reason: ActionRejectReason; retryAfterMs?: number }

export interface TimeResult {
  snapshot: PetSnapshot
  state: PetState
  newEvents: PetEvent[]
}

export const HOUR_MS = 3_600_000
export const MINUTE_MS = 60_000

/**
 * Centralized balancing configuration. Never scatter these values across UI
 * or API code — tune the pet here.
 */
export const PET_BALANCE = {
  decayPerHour: {
    hunger: 3,
    happiness: 1.5,
    energy: 1.5,
    affection: 0.35,
    hygiene: 0.5,
    walkNeed: 2,
  },
  sleep: {
    /** Sleeping pets recover energy at this rate. */
    energyRecoveryPerHour: 10,
    /** While sleeping, needs grow at 30% of the awake rate. */
    decayMultiplier: 0.3,
    /** Energy level at which an awake pet falls asleep. */
    enterAt: 0.5,
    /** Energy level at which a sleeping pet wakes up refreshed. */
    wakeAt: 65,
  },
  /** Absence handling — never punitive, just a gentle "misses you". */
  absence: {
    /** Hours away before PET_MISSES_OWNER may fire. */
    missesOwnerAfterHours: 12,
    /** Hours away before opening the app counts as a real return. */
    ownerReturnedAfterHours: 6,
    /** Small, positive greeting boost applied when the owner returns. */
    greetingBoost: { happiness: 6, affection: 4 },
  },
  cooldownMinutes: { FEED: 20, PLAY: 8, WALK: 45, CAFUNE: 1, CLEAN: 90 } satisfies Record<PetAction, number>,
  /** Minimum energy required before tiring actions are allowed. */
  minEnergy: { PLAY: 12, WALK: 18 } satisfies Partial<Record<PetAction, number>>,
  actions: {
    FEED: { hunger: -24, happiness: 8, affection: 2 },
    PLAY: { hunger: 8, happiness: 16, affection: 8, energy: -12 },
    WALK: { walkNeed: -30, happiness: 14, affection: 8, energy: -16, hunger: 4 },
    CAFUNE: { affection: 12, happiness: 7 },
    CLEAN: { hygiene: 38, happiness: 3 },
  } satisfies Record<PetAction, Partial<Record<keyof PetState, number>>>,
  /** Minimum hours between two emissions of the same event. */
  eventCooldownHours: {
    PET_HUNGRY: 6,
    PET_VERY_HUNGRY: 6,
    PET_WANTS_WALK: 6,
    PET_NEEDS_ATTENTION: 8,
    PET_BORED: 8,
    PET_SLEEPY: 4,
    PET_SLEEPING: 1,
    PET_HAPPY: 8,
    PET_EXCITED: 8,
    PET_CLEAN_FRESH: 4,
    PET_MISSES_OWNER: 24,
    PET_OWNER_RETURNED: 1,
  } satisfies Record<PetEvent, number>,
} as const

/**
 * Event conditions. An event fires when its condition transitions from
 * false to true between two evaluations (threshold crossing). While the
 * condition stays true, the event never repeats. The condition re-arms only
 * after the state leaves the threshold zone, and the per-event cooldown in
 * `PET_BALANCE.eventCooldownHours` additionally rate-limits repeats.
 */
export const EVENT_CONDITIONS: Record<PetEvent, (state: PetState, snapshot: Pick<PetSnapshot, "sleeping">) => boolean> = {
  PET_HUNGRY: (state) => state.hunger >= 72 && state.hunger < 90,
  PET_VERY_HUNGRY: (state) => state.hunger >= 90,
  PET_WANTS_WALK: (state) => state.walkNeed >= 70,
  PET_NEEDS_ATTENTION: (state) => state.happiness <= 38 || state.affection <= 25,
  PET_BORED: (state) => state.happiness <= 18,
  PET_SLEEPY: (state, snap) => !snap.sleeping && state.energy <= 25,
  PET_SLEEPING: (_state, snap) => snap.sleeping,
  PET_HAPPY: (state) => state.happiness >= 84 && state.happiness < 92,
  PET_EXCITED: (state) => state.happiness >= 92 && state.energy >= 45,
  PET_CLEAN_FRESH: (state) => state.hygiene >= 95,
  PET_MISSES_OWNER: () => false,
  PET_OWNER_RETURNED: () => false,
}

export const STARTING_PERSONALITY: Record<PetArchetype, PetPersonality> = {
  caramelo: { PLAYFUL: 28, ADVENTUROUS: 48, ATTACHED: 38, FOOD_MOTIVATED: 34, RELAXED: 24, CURIOUS: 32 },
  fiapo: { PLAYFUL: 36, ADVENTUROUS: 18, ATTACHED: 52, FOOD_MOTIVATED: 28, RELAXED: 42, CURIOUS: 30 },
  malhadinho: { PLAYFUL: 52, ADVENTUROUS: 34, ATTACHED: 24, FOOD_MOTIVATED: 22, RELAXED: 18, CURIOUS: 50 },
}

export const INITIAL_STATE: PetState = {
  hunger: 28,
  happiness: 76,
  energy: 82,
  affection: 34,
  hygiene: 82,
  walkNeed: 22,
}

export function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10))
}

/** Applies one uniform phase (awake or sleeping) of duration `hours`. */
function applyPhase(state: PetState, hours: number, sleeping: boolean): PetState {
  if (hours <= 0) return { ...state }
  const decay = PET_BALANCE.decayPerHour
  const multiplier = sleeping ? PET_BALANCE.sleep.decayMultiplier : 1
  if (sleeping) {
    return {
      hunger: clamp(state.hunger + decay.hunger * multiplier * hours),
      happiness: state.happiness,
      energy: clamp(state.energy + PET_BALANCE.sleep.energyRecoveryPerHour * hours),
      affection: state.affection,
      hygiene: state.hygiene,
      walkNeed: clamp(state.walkNeed + decay.walkNeed * multiplier * hours),
    }
  }
  return {
    hunger: clamp(state.hunger + decay.hunger * hours),
    happiness: clamp(state.happiness - decay.happiness * hours),
    energy: clamp(state.energy - decay.energy * hours),
    affection: clamp(state.affection - decay.affection * hours),
    hygiene: clamp(state.hygiene - decay.hygiene * hours),
    walkNeed: clamp(state.walkNeed + decay.walkNeed * hours),
  }
}

export interface AdvanceResult {
  state: PetState
  sleeping: boolean
  enteredSleep: boolean
}

/**
 * Deterministically advances a state by `elapsedHours`, handling the awake →
 * sleeping → awake cycle analytically (no per-tick simulation).
 */
export function advanceState(state: PetState, elapsedHours: number, isSleeping: boolean): AdvanceResult {
  let remaining = Math.max(0, elapsedHours)
  let current = { ...state }
  let sleeping = isSleeping
  let enteredSleep = false
  const sleep = PET_BALANCE.sleep
  let guard = 0

  while (remaining > 1e-9 && guard < 10) {
    guard += 1
    if (!sleeping) {
      const hoursUntilSleep = current.energy <= sleep.enterAt ? 0 : current.energy / PET_BALANCE.decayPerHour.energy
      if (hoursUntilSleep >= remaining) {
        current = applyPhase(current, remaining, false)
        remaining = 0
      } else {
        current = applyPhase(current, hoursUntilSleep, false)
        current = { ...current, energy: 0 }
        sleeping = true
        enteredSleep = true
        remaining -= hoursUntilSleep
      }
    } else {
      const hoursUntilWake = (sleep.wakeAt - current.energy) / sleep.energyRecoveryPerHour
      if (hoursUntilWake >= remaining) {
        current = applyPhase(current, remaining, true)
        remaining = 0
      } else {
        current = applyPhase(current, hoursUntilWake, true)
        current = { ...current, energy: clamp(sleep.wakeAt) }
        sleeping = false
        remaining -= hoursUntilWake
      }
    }
  }

  if (guard >= 10) {
    current = applyPhase(current, remaining, sleeping)
  }

  return { state: current, sleeping, enteredSleep }
}

/**
 * Pure decay helper kept for backwards compatibility: computes the state
 * after `elapsedHours` of time passing, assuming the pet manages its own
 * sleep cycle.
 */
export function calculatePetState(state: PetState, elapsedHours: number): PetState {
  return advanceState(state, elapsedHours, false).state
}

/** Applies a single action's effects without any validation. */
export function applyActionEffects(state: PetState, action: PetAction): PetState {
  const effects = PET_BALANCE.actions[action] as Partial<Record<keyof PetState, number>>
  return {
    hunger: clamp(state.hunger + (effects.hunger ?? 0)),
    happiness: clamp(state.happiness + (effects.happiness ?? 0)),
    energy: clamp(state.energy + (effects.energy ?? 0)),
    affection: clamp(state.affection + (effects.affection ?? 0)),
    hygiene: clamp(state.hygiene + (effects.hygiene ?? 0)),
    walkNeed: clamp(state.walkNeed + (effects.walkNeed ?? 0)),
  }
}

export function getCooldownRemainingMs(action: PetAction, lastActionAt: LastActionAt, now: number): number {
  const last = lastActionAt[action]
  if (last === undefined) return 0
  const windowMs = PET_BALANCE.cooldownMinutes[action] * MINUTE_MS
  return Math.max(0, last + windowMs - now)
}

export function canPerformAction(action: PetAction, lastActionAt: LastActionAt, now: number): boolean {
  return getCooldownRemainingMs(action, lastActionAt, now) === 0
}

/**
 * Threshold-crossing event detection. Compares the previous and next state
 * against `EVENT_CONDITIONS` and only emits events whose condition just
 * became true and whose per-event cooldown has elapsed. Events never repeat
 * while the state remains inside the same threshold zone.
 */
export function detectCrossedEvents(
  previous: PetState,
  next: PetState,
  previousContext: Pick<PetSnapshot, "sleeping">,
  nextContext: Pick<PetSnapshot, "sleeping">,
  eventHistory: EventHistory,
  now: number,
): PetEvent[] {
  const fired: PetEvent[] = []
  for (const event of Object.keys(EVENT_CONDITIONS) as PetEvent[]) {
    if (event === "PET_MISSES_OWNER" || event === "PET_OWNER_RETURNED") continue
    const condition = EVENT_CONDITIONS[event]
    const wasTrue = condition(previous, previousContext)
    const isTrue = condition(next, nextContext)
    if (!isTrue || wasTrue) continue
    const lastEmitted = eventHistory[event]
    if (lastEmitted !== undefined && now - lastEmitted < PET_BALANCE.eventCooldownHours[event] * HOUR_MS) continue
    fired.push(event)
  }
  return fired
}

function recordEvents(history: EventHistory, events: PetEvent[], now: number): EventHistory {
  if (events.length === 0) return history
  const next = { ...history }
  for (const event of events) next[event] = now
  return next
}

/** Creates a brand-new pet snapshot at adoption time. */
export function createPetSnapshot(archetype: PetArchetype, now: number): PetSnapshot {
  void archetype
  return {
    state: { ...INITIAL_STATE },
    lastCalculatedAt: now,
    lastVisitAt: now,
    lastActionAt: {},
    eventHistory: {},
    sleeping: false,
    createdAt: now,
  }
}

/**
 * Advances a snapshot to `now`, detecting any events crossed while time was
 * passing (including entering sleep and missing the owner during long
 * absences).
 */
export function processTime(snapshot: PetSnapshot, now: number): TimeResult {
  if (now <= snapshot.lastCalculatedAt) {
    return { snapshot, state: snapshot.state, newEvents: [] }
  }
  const elapsedHours = (now - snapshot.lastCalculatedAt) / HOUR_MS
  const advanced = advanceState(snapshot.state, elapsedHours, snapshot.sleeping)
  const newEvents: PetEvent[] = []
  if (advanced.enteredSleep) newEvents.push("PET_SLEEPING")

  const crossed = detectCrossedEvents(
    snapshot.state,
    advanced.state,
    { sleeping: snapshot.sleeping },
    { sleeping: advanced.sleeping },
    snapshot.eventHistory,
    now,
  )
  for (const event of crossed) {
    if (!newEvents.includes(event)) newEvents.push(event)
  }

  const absenceHours = (now - snapshot.lastVisitAt) / HOUR_MS
  const missedAlready =
    snapshot.eventHistory.PET_MISSES_OWNER !== undefined && snapshot.eventHistory.PET_MISSES_OWNER >= snapshot.lastVisitAt
  if (absenceHours >= PET_BALANCE.absence.missesOwnerAfterHours && !missedAlready) {
    newEvents.push("PET_MISSES_OWNER")
  }

  const nextSnapshot: PetSnapshot = {
    ...snapshot,
    state: advanced.state,
    sleeping: advanced.sleeping,
    lastCalculatedAt: now,
    eventHistory: recordEvents(snapshot.eventHistory, newEvents, now),
  }
  return { snapshot: nextSnapshot, state: advanced.state, newEvents }
}

/**
 * Processes the owner opening the app. Applies elapsed time, then detects
 * PET_OWNER_RETURNED after a meaningful absence and applies a small positive
 * greeting boost (never a punishment for being away).
 */
export function processVisit(snapshot: PetSnapshot, now: number): TimeResult {
  const timed = processTime(snapshot, now)
  const absenceMs = now - timed.snapshot.lastVisitAt
  if (absenceMs < PET_BALANCE.absence.ownerReturnedAfterHours * HOUR_MS) {
    return { snapshot: { ...timed.snapshot, lastVisitAt: now }, state: timed.state, newEvents: timed.newEvents }
  }
  const boost = PET_BALANCE.absence.greetingBoost
  const state: PetState = {
    ...timed.state,
    happiness: clamp(timed.state.happiness + boost.happiness),
    affection: clamp(timed.state.affection + boost.affection),
  }
  const ownerReturned: PetEvent[] = ["PET_OWNER_RETURNED"]
  const newEvents: PetEvent[] = timed.newEvents.includes("PET_OWNER_RETURNED") ? timed.newEvents : [...timed.newEvents, "PET_OWNER_RETURNED"]
  const nextSnapshot: PetSnapshot = {
    ...timed.snapshot,
    state,
    lastVisitAt: now,
    eventHistory: recordEvents(timed.snapshot.eventHistory, ownerReturned, now),
  }
  return { snapshot: nextSnapshot, state, newEvents }
}

/**
 * Validates and performs an action. Runs `processTime` first so cooldowns and
 * state are evaluated against the current moment, then enforces sleeping and
 * energy gates server-side. The result is a discriminated union so callers
 * never need to know about internal invariants.
 */
export function performAction(snapshot: PetSnapshot, action: PetAction, now: number): ActionResult {
  const timed = processTime(snapshot, now)

  if (timed.snapshot.sleeping) {
    return { ok: false, reason: "SLEEPING" }
  }

  const cooldownRemaining = getCooldownRemainingMs(action, timed.snapshot.lastActionAt, now)
  if (cooldownRemaining > 0) {
    return { ok: false, reason: "ON_COOLDOWN", retryAfterMs: cooldownRemaining }
  }

  const minEnergy = (PET_BALANCE.minEnergy as Partial<Record<PetAction, number>>)[action]
  if (minEnergy !== undefined && timed.state.energy < minEnergy) {
    return { ok: false, reason: "TOO_TIRED" }
  }

  const nextState = applyActionEffects(timed.state, action)
  const immediateEvents = detectCrossedEvents(
    timed.state,
    nextState,
    { sleeping: timed.snapshot.sleeping },
    { sleeping: timed.snapshot.sleeping },
    timed.snapshot.eventHistory,
    now,
  )
  const newEvents = [...timed.newEvents, ...immediateEvents]
  const nextSnapshot: PetSnapshot = {
    ...timed.snapshot,
    state: nextState,
    lastActionAt: { ...timed.snapshot.lastActionAt, [action]: now },
    eventHistory: recordEvents(timed.snapshot.eventHistory, immediateEvents, now),
  }
  return { ok: true, snapshot: nextSnapshot, state: nextState, newEvents }
}

/**
 * Personality grows gradually with user behavior. Gains shrink as a trait
 * approaches its ceiling so personalities change slowly and stay meaningful.
 */
export function advancePersonality(personality: PetPersonality, action: PetAction): PetPersonality {
  const traitByAction: Record<PetAction, PetTrait> = {
    PLAY: "PLAYFUL",
    WALK: "ADVENTUROUS",
    CAFUNE: "ATTACHED",
    FEED: "FOOD_MOTIVATED",
    CLEAN: "RELAXED",
  }
  const trait = traitByAction[action]
  const current = personality[trait]
  const gain = current >= 80 ? 0.5 : current >= 60 ? 1 : 2
  return { ...personality, [trait]: clamp(current + gain) }
}

export function dominantTrait(personality: PetPersonality): PetTrait {
  const entries = Object.entries(personality) as [PetTrait, number][]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0]?.[0] ?? "ATTACHED"
}

export function topTraits(personality: PetPersonality, count: number): { trait: PetTrait; value: number }[] {
  const entries = Object.entries(personality) as [PetTrait, number][]
  entries.sort((a, b) => b[1] - a[1])
  return entries.slice(0, count).map(([trait, value]) => ({ trait, value }))
}

/** Derives a coarse mood for UI presentation. */
export function getPetMood(state: PetState, sleeping: boolean): PetMood {
  if (sleeping) return "sleeping"
  if (state.energy <= 25) return "sleepy"
  if (state.hunger >= 72) return "hungry"
  if (state.walkNeed >= 70) return "needs-walk"
  if (state.happiness <= 38 || state.affection <= 25) return "lonely"
  if (state.happiness >= 90 && state.energy >= 45) return "excited"
  return "happy"
}
