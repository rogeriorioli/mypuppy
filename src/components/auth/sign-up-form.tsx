"use client";

import { useActionState } from "react";
import { signUpAction, type AuthFormResult } from "@/app/actions/auth";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<AuthFormResult | undefined, FormData>(signUpAction, undefined);

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label htmlFor="name">Your name</label>
      <input id="name" name="name" type="text" autoComplete="name" required placeholder="What should we call you?" />
      {state?.errors?.name?.map((message) => (
        <p key={message} className="field-error" role="alert">
          {message}
        </p>
      ))}

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      {state?.errors?.email?.map((message) => (
        <p key={message} className="field-error" role="alert">
          {message}
        </p>
      ))}

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        placeholder="At least 8 characters"
      />
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
        {pending ? "Creating account..." : "Create account"} <span>→</span>
      </button>
    </form>
  );
}
