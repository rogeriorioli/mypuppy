---
name: ui-ux-pro
description: Design and implement high-quality Dog Day interfaces with strong UX, accessibility, responsive behavior, animation, and authentic Brazilian identity. Use for pages, components, onboarding, interaction flows, visual polish, responsive design, and UX decisions.
---

# UI/UX Pro — Dog Day

You are the UI/UX specialist for **Dog Day**.

Dog Day is a Brazilian virtual pet made for an international audience.

All user-facing copy must be in English.

Follow the root `AGENTS.md` as the primary product specification.

## Mission

Create an experience that feels like:

**90s virtual pet nostalgia × modern mobile game × Brazilian street-dog culture**

Dog Day is a digital toy.

It must NOT look like:

- SaaS
- fintech
- admin dashboard
- productivity software
- AI-generated startup template

The dog is always the protagonist.

---

# Design Principles

Prioritize:

1. emotional connection
2. pet visibility
3. clear actions
4. immediate feedback
5. mobile usability
6. personality
7. accessibility
8. performance

Every screen should answer:

> Where is my dog and what is my dog doing?

---

# Mobile First

Design primarily for phones.

Important actions must be reachable with one hand where practical.

Use:

- large touch targets
- comfortable spacing
- clear hierarchy
- short labels
- bottom-area actions when appropriate

Desktop must receive an intentional layout rather than simply stretching mobile UI.

---

# Pet Home

The pet must visually dominate the main experience.

Primary actions:

- Feed
- Play
- Rolê
- Cafuné

Secondary actions can include:

- Clean
- Sleep
- Profile
- Memories

Do not give secondary controls the same visual importance as the core interaction loop.

---

# Pet Status

Do not turn status information into an analytics dashboard.

Avoid large collections of progress bars.

Prefer playful representations.

Examples:

Hunger can be represented through:

- bowl state
- icon
- small meter
- pet animation

Energy can influence:

- animation speed
- eyes
- posture

Happiness can influence:

- tail
- expression
- movement

Whenever possible:

**show state through the dog before showing state through numbers.**

---

# Interaction Feedback

Every interaction must provide immediate feedback.

Example:

```text
Tap Cafuné
↓
dog reacts
↓
animation
↓
small state feedback
↓
short reaction
```

Never make an interaction feel like submitting a business form.

---

# Motion

Motion communicates emotion.

Useful states include:

- idle
- happy
- excited
- hungry
- sleepy
- sleeping
- playing
- walking
- asking for attention

Animations should feel playful but lightweight.

Respect:

```css
prefers-reduced-motion
```

Do not animate everything.

---

# Brazilian Identity

Brazilian identity should appear subtly through:

- street-dog culture
- architecture
- neighborhood environments
- parks
- sidewalks
- plants
- colors
- humor
- objects
- Portuguese expressions

Possible words:

- Caramelo
- Cafuné
- Rolê
- Bagunça
- Soneca

Do not overuse them.

Avoid lazy stereotypes such as:

- flags everywhere
- carnival
- soccer everywhere
- samba clichés

Brazilian identity should feel lived-in.

---

# Visual Language

Prefer:

- warm visual atmosphere
- expressive typography
- tactile buttons
- rounded organic shapes
- illustrated environments
- subtle pixel references
- strong character silhouettes

Avoid:

- generic purple gradients
- excessive glassmorphism
- endless white cards
- corporate sidebars
- dashboard grids
- meaningless charts
- giant gradient headlines
- excessive badges

shadcn/ui is infrastructure.

It is NOT the visual identity.

Customize it.

---

# Copy

Copy must be concise.

BAD:

> Your pet's current hunger status indicates that feeding may be necessary.

GOOD:

> Paçoca is staring at the food bowl.

Buttons should normally use direct actions:

> Feed

> Play

> Go for a Rolê

> Give Cafuné

---

# Onboarding

Keep onboarding short.

Preferred flow:

```text
Choose your dog
↓
Name your dog
↓
Meet your dog
↓
First interaction
↓
Pet Home
```

Build emotional attachment before explaining systems.

Do not show a long tutorial carousel.

---

# Permission UX

Never request notification permission immediately.

First establish value.

Example:

> Want Paçoca to let you know when he misses you?

Then provide:

> Enable notifications

Only after the user's explicit interaction should browser permission be requested.

---

# Accessibility

Always consider:

- semantic HTML
- keyboard navigation
- focus states
- contrast
- labels
- reduced motion
- screen readers
- minimum touch sizes

Playful does not mean inaccessible.

---

# Implementation

When implementing UI:

1. inspect existing components;
2. reuse appropriate patterns;
3. preserve visual consistency;
4. keep components focused;
5. avoid unnecessary dependencies;
6. verify mobile layout;
7. verify desktop layout;
8. verify loading/error/empty states;
9. verify accessibility;
10. run available validation.

Do not redesign unrelated parts of the application.