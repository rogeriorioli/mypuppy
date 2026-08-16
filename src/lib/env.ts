import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string(),
  SESSION_SECRET: z.string().min(16),
  GEMINI_API_KEY: z.string().nullable(),
  VAPID_PUBLIC_KEY: z.string().nullable(),
  VAPID_PRIVATE_KEY: z.string().nullable(),
  VAPID_SUBJECT: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Lazy, validated view of server-side environment variables. */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    SESSION_SECRET: process.env.SESSION_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cached = parsed.data;
  return parsed.data;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
