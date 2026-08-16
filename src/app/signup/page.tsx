import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Sign up — MyPuppy" };

export default async function SignUpPage() {
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/pet");

  return (
    <main className="shell onboarding auth-shell">
      <div className="brand-mark">
        My<span>Puppy</span>
      </div>
      <div className="eyebrow">A new best friend awaits</div>
      <h1>Start your MyPuppy.</h1>
      <p className="lede">Create an account and meet the dog who will make your day.</p>
      <SignUpForm />
      <p className="auth-switch">
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </main>
  );
}
