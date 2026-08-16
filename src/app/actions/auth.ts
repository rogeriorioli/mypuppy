"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession, destroySession, setSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

const credentialsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60, "Name is too long."),
  email: z.email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(100, "Password is too long."),
});

export interface AuthFormResult {
  ok: boolean;
  errors?: Record<string, string[]>;
  message?: string;
}

export async function signUpAction(_previous: AuthFormResult | undefined, formData: FormData): Promise<AuthFormResult> {
  const parsed = credentialsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (errors[key] ??= []).push(issue.message);
    }
    return { ok: false, errors };
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, errors: { email: ["An account with this email already exists."] } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, setSessionCookieOptions());
  redirect("/pet");
}

const signInSchema = z.object({
  email: z.email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Enter your password."),
});

export async function signInAction(_previous: AuthFormResult | undefined, formData: FormData): Promise<AuthFormResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, errors: { form: ["Enter your email and password."] } };
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { ok: false, errors: { form: ["Invalid email or password."] } };
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { ok: false, errors: { form: ["Invalid email or password."] } };
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, setSessionCookieOptions());
  redirect("/pet");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
