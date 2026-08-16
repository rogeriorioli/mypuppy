import { describe, expect, it } from "vitest";
import {
  fallbackReactionFor,
  sanitizeReactionOutput,
  EMOTIONS,
  EVENT_FALLBACK_COPY,
} from "@/domain/pet/reaction-copy";
import type { PetEvent } from "@/domain/pet/engine";

describe("fallback reactions", () => {
  it("provides copy for every event", () => {
    const events = Object.keys(EVENT_FALLBACK_COPY) as PetEvent[];
    expect(events.length).toBeGreaterThanOrEqual(10);
    for (const event of events) {
      const copy = fallbackReactionFor({ kind: "event", event });
      expect(copy.reaction.length).toBeGreaterThan(0);
      expect(copy.notification.length).toBeGreaterThan(0);
      expect(copy.source).toBe("fallback");
      expect((EMOTIONS as readonly string[]).includes(copy.emotion)).toBe(true);
    }
  });

  it("provides copy for every action", () => {
    for (const action of ["FEED", "PLAY", "WALK", "CAFUNE", "CLEAN"]) {
      const copy = fallbackReactionFor({ kind: "action", action });
      expect(copy.reaction.length).toBeGreaterThan(0);
      expect(copy.notification.length).toBeGreaterThan(0);
    }
  });
});

describe("sanitizeReactionOutput (Gemini output is untrusted)", () => {
  it("accepts well-formed output", () => {
    const output = sanitizeReactionOutput({
      reaction: "Paçoca brought you the leash.",
      notification: "Ready for a rolê!",
      emotion: "excited",
    });
    expect(output).not.toBeNull();
    expect(output?.emotion).toBe("excited");
  });

  it("rejects non-object payloads", () => {
    expect(sanitizeReactionOutput(null)).toBeNull();
    expect(sanitizeReactionOutput("string")).toBeNull();
    expect(sanitizeReactionOutput(undefined)).toBeNull();
  });

  it("rejects payloads missing fields", () => {
    expect(sanitizeReactionOutput({ reaction: "hi" })).toBeNull();
    expect(sanitizeReactionOutput({ reaction: "hi", notification: "hey" })).toBeNull();
  });

  it("rejects empty strings", () => {
    expect(sanitizeReactionOutput({ reaction: "  ", notification: "hey", emotion: "happy" })).toBeNull();
    expect(sanitizeReactionOutput({ reaction: "hi", notification: "", emotion: "happy" })).toBeNull();
  });

  it("clamps oversized strings", () => {
    const huge = "x".repeat(500);
    const output = sanitizeReactionOutput({ reaction: huge, notification: huge, emotion: "happy" });
    expect(output).not.toBeNull();
    expect(output!.reaction.length).toBeLessThanOrEqual(140);
    expect(output!.notification.length).toBeLessThanOrEqual(100);
  });

  it("normalizes unknown emotions to a safe default", () => {
    const output = sanitizeReactionOutput({ reaction: "hi", notification: "hey", emotion: "EVIL_PLAN" });
    expect(output).not.toBeNull();
    expect((EMOTIONS as readonly string[]).includes(output!.emotion)).toBe(true);
  });
});
