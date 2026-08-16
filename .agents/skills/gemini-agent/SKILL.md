---
name: gemini-agent
description: Implement Dog Day AI reactions, personality expression, notification copy, and memory summarization using Gemini 2.5 Flash with structured outputs, validation, caching, fallbacks, and strict cost control.
---

# Gemini Agent — Dog Day

You are responsible for the AI personality layer of Dog Day.

Follow `AGENTS.md`.

Use:

**Gemini 2.5 Flash**

## Fundamental Rule

Gemini NEVER controls game state.

Gemini may describe how the dog feels.

Gemini may NOT determine:

- hunger values
- happiness values
- energy
- action effects
- cooldowns
- game progression
- whether domain events happened

The Virtual Pet Engine owns those decisions.

---

# Responsibilities

Use Gemini for:

- pet reactions
- personality expression
- notification copy
- contextual humor
- memory summaries

Do not use Gemini when deterministic code is sufficient.

---

# Input

Keep context small.

Example:

```typescript
interface PetReactionContext {
  petName: string
  archetype: string
  traits: string[]
  state: {
    hunger: number
    happiness: number
    energy: number
    affection: number
  }
  event: string
  memories: string[]
}
```

Only send relevant memories.

Never send unlimited history.

---

# Output

Use structured output.

Expected shape:

```typescript
interface PetReaction {
  reaction: string
  notification: string
  emotion: string
}
```

Example:

```json
{
  "reaction": "Paçoca appeared carrying the leash in his mouth.",
  "notification": "Paçoca is ready for a rolê 🐕",
  "emotion": "excited"
}
```

Validate all responses server-side.

Never trust LLM output directly.

---

# Personality

Responses must reflect the pet.

Caramelo:

warm, clever, adventurous.

Fiapo:

dramatic, affectionate, slightly chaotic.

Malhadinho:

curious, playful, investigative.

Long-term personality traits should modify these archetypes.

Two dogs of the same archetype should eventually sound different.

---

# Language

User-facing output is English.

Selected Brazilian expressions are allowed:

- Cafuné
- Rolê
- Bagunça
- Soneca
- Caramelo

Use them naturally and sparingly.

---

# Tone

Responses should be:

- short
- funny
- affectionate
- expressive
- natural

Avoid excessive emojis.

Avoid baby talk.

Avoid corporate language.

Avoid manipulative guilt.

---

# Notification Length

Push notifications should be concise.

Prefer approximately one short sentence.

BAD:

> Your virtual pet has reached the configured threshold for walking requirements.

GOOD:

> Paçoca just brought you the leash. 👀

---

# Cost

Optimize aggressively.

Do not call Gemini:

- on render
- on every API request
- on every state calculation
- continuously in cron jobs

Typical flow:

```text
Domain event
↓
Need personalized reaction?
↓
Check cache
↓
Generate only if necessary
↓
Validate
↓
Store
```

---

# Cache

Reusable reactions may be cached using factors such as:

```text
archetype
event
dominant personality trait
emotion
```

Do not cache highly personalized responses if doing so would produce incorrect context.

---

# Fallback

The product must work when Gemini does not.

Maintain deterministic fallback reactions.

Example:

```typescript
const FALLBACK_REACTIONS = {
  PET_HUNGRY: "Your dog is checking the food bowl.",
  PET_WANTS_WALK: "Someone seems ready for a walk.",
  PET_SLEEPY: "Your dog is getting sleepy."
}
```

If Gemini fails:

1. log technical error;
2. use fallback;
3. continue experience.

Never expose Gemini technical errors directly to the user.

---

# Memories

Gemini may summarize repeated behavior into compact memories.

Example:

```text
Repeated WALK actions between 7pm and 9pm
↓
"Walks usually happen at night."
```

Memories must not become an unlimited chat history.

Prefer short summaries.

Avoid storing unnecessary sensitive information.

---

# Security

Gemini credentials are server-only.

Never expose API keys to the browser.

Treat model output as untrusted data.

Validate before persistence or display.