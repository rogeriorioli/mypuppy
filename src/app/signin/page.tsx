import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in — MyPuppy" };

export default async function SignInPage() {
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/pet");

  return (
    <main className="shell onboarding auth-shell">
      <div className="brand-mark">
        My<span>Puppy</span>
      </div>
      <div className="eyebrow">Welcome back</div>
      <h1>Your dog missed you.</h1>
      <p className="lede">Sign in to continue your story together.</p>
      <SignInForm />
      <p className="auth-switch">
        First time here? <Link href="/signup">Create an account</Link>
      </p>
    </main>
  );
}
