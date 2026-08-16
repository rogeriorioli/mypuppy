"use client";

import { useActionState } from "react";
import { signInAction, type AuthFormResult } from "@/app/actions/auth";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<AuthFormResult | undefined, FormData>(signInAction, undefined);

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      {state?.errors?.email?.map((message) => (
        <p key={message} className="field-error" role="alert">
          {message}
        </p>
      ))}

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Your password" />
      {state?.errors?.password?.map((message) => (
        <p key={message} className="field-error" role="alert">
          {message}
        </p>
      ))}

      {state?.errors?.form?.map((message) => (
        <p key={message} className="form-error" role="alert">
          {message}
        </p>
      ))}

      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"} <span>→</span>
      </button>
    </form>
  );
}
