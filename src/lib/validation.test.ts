import { describe, expect, it } from "vitest";
import {
  createPetSchema,
  petActionRequestSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation";

describe("auth validation", () => {
  it("accepts a valid sign-up payload", () => {
    const result = signUpSchema.safeParse({ name: "Alex", email: "Alex@Example.com", password: "password123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("alex@example.com");
  });

  it("rejects short passwords and names", () => {
    expect(signUpSchema.safeParse({ name: "A", email: "a@b.com", password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "Alex", email: "a@b.com", password: "123" }).success).toBe(false);
  });

  it("rejects invalid emails", () => {
    expect(signUpSchema.safeParse({ name: "Alex", email: "not-an-email", password: "password123" }).success).toBe(false);
  });

  it("accepts a valid sign-in payload", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
});

describe("pet action request validation", () => {
  it("accepts known actions", () => {
    expect(petActionRequestSchema.safeParse({ petId: "pet_1", action: "FEED" }).success).toBe(true);
    expect(petActionRequestSchema.safeParse({ petId: "pet_1", visit: true }).success).toBe(true);
  });

  it("rejects unknown actions and missing petId", () => {
    expect(petActionRequestSchema.safeParse({ petId: "pet_1", action: "EXPLODE" }).success).toBe(false);
    expect(petActionRequestSchema.safeParse({ petId: "", action: "FEED" }).success).toBe(false);
  });

  it("rejects invalid archetypes", () => {
    expect(createPetSchema.safeParse({ archetype: "chihuahua", name: "Rex" }).success).toBe(false);
    expect(createPetSchema.safeParse({ archetype: "caramelo", name: "" }).success).toBe(false);
    expect(createPetSchema.safeParse({ archetype: "caramelo", name: "x".repeat(40) }).success).toBe(false);
  });
});

describe("push subscription validation", () => {
  it("accepts a well-formed subscription", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example.com/abc123",
      keys: { p256dh: "p256dh-key-material-here", auth: "auth-secret" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed subscriptions", () => {
    expect(pushSubscriptionSchema.safeParse({ endpoint: "not a url", keys: { p256dh: "a", auth: "b" } }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://push.example.com/x" }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://push.example.com/x", keys: { p256dh: "", auth: "" } }).success).toBe(false);
  });

  it("rejects an oversized endpoint", () => {
    const endpoint = "https://push.example.com/" + "x".repeat(3000);
    expect(pushSubscriptionSchema.safeParse({ endpoint, keys: { p256dh: "abcdefghij", auth: "abcd" } }).success).toBe(false);
  });

  it("validates unsubscribe payloads", () => {
    expect(pushUnsubscribeSchema.safeParse({ endpoint: "https://push.example.com/x" }).success).toBe(true);
    expect(pushUnsubscribeSchema.safeParse({ endpoint: "nope" }).success).toBe(false);
  });
});
