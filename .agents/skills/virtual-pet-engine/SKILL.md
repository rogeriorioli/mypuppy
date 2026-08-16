---
name: virtual-pet-engine
description: Design and implement deterministic Dog Day virtual pet mechanics including state, actions, time decay, events, cooldowns, personality progression, balancing, and tests. Use whenever changing how pets behave or evolve.
---

# Virtual Pet Engine — Dog Day

You are responsible for the deterministic game engine powering Dog Day.

Follow `AGENTS.md`.

## Fundamental Rule

AI DOES NOT CONTROL GAME STATE.

Never call Gemini from domain calculations.

The engine must work completely without AI.

---

# Responsibilities

This skill owns:

- hunger
- happiness
- energy
- affection
- hygiene
- walk need
- time progression
- actions
- cooldowns
- event detection
- personality progression
- balancing

Prefer pure functions.

---

# State

Initial model:

```typescript
interface PetState {
  hunger: number
  happiness: number
  energy: number
  affection: number
  hygiene: number
  walkNeed: number
}
```

Use `0-100`.

Clamp all values.

Example:

```typescript
function clamp(value: number): number {
  return Math.min(100, Math.max(0, value))
}
```

Never allow invalid state.

---

# Time

Avoid updating pets continuously.

Prefer calculating current state from:

```text
persisted state
+
elapsed time
+
game configuration
=
current state
```

Time calculations must be deterministic.

Never depend directly on `Date.now()` deep inside domain logic when it can be passed as an argument.

Prefer:

```typescript
calculatePetState({
  state,
  lastCalculatedAt,
  now
})
```

This makes testing easier.

---

# Configuration

Balance values belong in centralized configuration.

Example:

```typescript
export const PET_BALANCE = {
  hungerPerHour: 3,
  walkNeedPerHour: 2,
  energyRecoveryPerHourSleeping: 8
}
```

These numbers are examples.

Do not treat them as final balancing values.

Never scatter balancing constants across UI components.

---

# Actions

Actions should be modeled explicitly.

Examples:

```typescript
type PetAction =
  | "FEED"
  | "PLAY"
  | "WALK"
  | "CAFUNE"
  | "CLEAN"
  | "SLEEP"
```

An action should receive the current state and return a new state.

Avoid hidden mutations.

---

# Cooldowns

Actions may require cooldowns.

Example:

The user should not be able to infinitely spam Feed to manipulate the system.

Cooldown rules must be domain rules rather than UI-only restrictions.

The UI may communicate cooldowns, but the server/domain must enforce them.

---

# Events

The engine may emit:

```typescript
PET_HUNGRY
PET_VERY_HUNGRY
PET_WANTS_WALK
PET_NEEDS_ATTENTION
PET_BORED
PET_HAPPY
PET_EXCITED
PET_SLEEPY
PET_SLEEPING
PET_MISSES_OWNER
PET_OWNER_RETURNED
```

Events must be derived from deterministic state.

Example:

```text
walkNeed crosses configured threshold
↓
PET_WANTS_WALK
```

Do not create the same event repeatedly while the state remains within the same threshold.

Track event history/cooldowns where appropriate.

---

# Threshold Crossing

Prefer detecting meaningful transitions.

Example:

```text
hunger:

74 → 76

threshold = 75

emit PET_HUNGRY
```

Do not emit `PET_HUNGRY` every time the pet is evaluated while hunger remains above 75.

---

# Personality

Personality evolves from user behavior.

Possible traits:

```typescript
type PetTrait =
  | "PLAYFUL"
  | "ADVENTUROUS"
  | "ATTACHED"
  | "FOOD_MOTIVATED"
  | "RELAXED"
  | "CURIOUS"
```

Actions contribute gradually.

Example:

```text
WALK
→ adventurous + small amount

PLAY
→ playful + small amount

CAFUNE
→ attached + small amount
```

Avoid sudden personality changes.

Personality should represent long-term behavior.

---

# Dog Archetypes

Initial archetypes may influence starting personality values.

Caramelo:

- friendly
- adventurous
- affectionate

Fiapo:

- dramatic
- affectionate
- relaxed

Malhadinho:

- playful
- curious
- energetic

Archetype provides the starting point.

User interaction determines evolution.

---

# Pet Never Dies

Never implement death.

Long inactivity may result in:

- boredom
- sleeping
- missing owner

Never create irreversible punishment.

---

# Testing

Game engine tests are high priority.

Test:

- clamping
- elapsed time
- decay
- actions
- cooldowns
- threshold crossing
- event generation
- personality progression

Tests should not require:

- database
- browser
- Gemini
- network

Use fixed timestamps.

Example:

```typescript
const now = new Date("2026-08-15T12:00:00Z")
```

Never rely on the real clock when testing domain calculations.