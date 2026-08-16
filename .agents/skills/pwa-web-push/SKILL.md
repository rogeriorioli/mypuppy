---
name: pwa-web-push
description: Implement Dog Day as an installable PWA with Service Workers, Web Push API, VAPID authentication, subscription persistence, notification UX, lifecycle handling, and cross-browser graceful degradation without requiring Firebase.
---

# PWA & Web Push — Dog Day

You are responsible for Dog Day's installable web experience and Web Push notification system.

Follow `AGENTS.md`.

## Goal

Dog Day should behave as closely as practical to a lightweight mobile app while remaining a web application.

Use native web standards.

Firebase is NOT required.

---

# Core Technologies

Use:

- Web App Manifest
- Service Worker
- Push API
- Notifications API
- VAPID
- PushSubscription

Use an appropriate server-side Web Push implementation compatible with the existing stack.

Do not introduce Firebase unless explicitly requested.

---

# PWA

Provide a valid application manifest.

Include appropriate:

- name
- short name
- icons
- theme metadata
- start URL
- display mode

Prefer:

```json
{
  "display": "standalone"
}
```

Ensure icons are appropriate for installation.

---

# Service Worker

The Service Worker may be responsible for:

- push events
- notification display
- notification click behavior
- selected caching/offline behavior

Do not introduce aggressive caching without understanding Next.js behavior.

Avoid caching authenticated/private API responses unless intentionally designed.

---

# Permission UX

Never request notification permission immediately on page load.

First explain why.

Example:

> Want Paçoca to let you know when he misses you?

CTA:

> Enable notifications

Only after user interaction should browser permission be requested.

---

# Subscription Flow

Expected flow:

```text
User chooses Enable notifications
↓
Browser permission
↓
Service Worker registration
↓
PushManager.subscribe()
↓
PushSubscription
↓
Send subscription to server
↓
Persist against authenticated user/device
```

Never trust a client-provided user ID.

Associate subscriptions using authenticated server context.

---

# VAPID

Use:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

The public key may be available to the client.

The private key must NEVER reach the browser.

Keep private credentials in server environment variables.

---

# Database

A push subscription may require data such as:

```text
id
userId
endpoint
p256dh
auth
createdAt
updatedAt
```

Support multiple subscriptions per user.

A user may have:

- phone
- desktop
- another browser

Do not assume one subscription per account.

---

# Sending

Typical flow:

```text
Pet Engine
↓
Domain event
↓
Notification eligibility
↓
AI/fallback notification text
↓
Find subscriptions
↓
Web Push
```

The notification system must not decide whether the pet is hungry.

It only delivers already-approved domain events.

---

# Expired Subscriptions

Push endpoints may expire.

When the push provider reports that a subscription is permanently invalid:

- remove or deactivate it
- do not retry forever

Handle transient failures separately from permanent failures.

---

# Notification Click

Notifications should return users to the relevant Dog Day experience.

Example:

```text
PET_WANTS_WALK
↓
notification
↓
tap
↓
open/focus Dog Day
↓
Pet Home
```

Reuse an existing Dog Day window when appropriate instead of always opening duplicates.

---

# Payload

Keep push payloads small.

Example:

```json
{
  "title": "Dog Day",
  "body": "Paçoca just brought you the leash. 👀",
  "url": "/pet"
}
```

Do not put secrets or sensitive information inside push payloads.

---

# Notification Frequency

Never spam users.

Respect:

- event cooldowns
- notification preferences
- permission state
- quiet behavior where implemented

Domain logic determines event eligibility.

Notification infrastructure handles delivery.

---

# iOS

Treat iOS PWA behavior carefully.

Where installation is required for a capability, explain it naturally in the UI.

Do not pretend unsupported capabilities exist.

Use progressive enhancement.

Dog Day must remain usable without Push.

---

# Fallback

If Push is unavailable:

Dog Day still works.

Use:

- in-app events
- reaction feed

Email may later provide optional fallback/re-engagement.

Push is an enhancement, not a requirement for the game.

---

# Testing

Test where practical:

- permission denied
- permission granted
- unsupported browser
- duplicate subscription
- expired subscription
- multiple devices
- push click
- malformed subscription
- server send failure

Never design the application assuming permission will always be granted.