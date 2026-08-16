import { z } from "zod";

/** Shared, testable request validation schemas. */

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60, "Name is too long."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(200, "Email is too long.")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters.").max(100, "Password is too long."),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Enter your password."),
});

export const petActionRequestSchema = z.object({
  petId: z.string().min(1).max(64),
  action: z.enum(["FEED", "PLAY", "WALK", "CAFUNE", "CLEAN"]).optional(),
  visit: z.boolean().optional(),
});

export const createPetSchema = z.object({
  archetype: z.enum(["caramelo", "fiapo", "malhadinho"]),
  name: z.string().trim().min(1, "Choose a name.").max(18, "Name must be 18 characters or fewer."),
});

/** Push subscriptions come from untrusted clients and must be validated strictly. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(2).max(256),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});
