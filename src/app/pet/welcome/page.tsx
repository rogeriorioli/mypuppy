import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdoptForm } from "@/components/pet/adopt-form";

export const metadata = { title: "Choose your dog — MyPuppy" };

export default async function WelcomePage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/signin");

  return (
    <main className="shell onboarding">
      <div className="brand-mark">
        My<span>Puppy</span>
      </div>
      <div className="eyebrow">Step 1 of 2 — Choose your companion</div>
      <h1>Every good story starts with a name.</h1>
      <p className="lede">Pick one of Brazil&rsquo;s finest mixed-breed legends and give them a name.</p>
      <AdoptForm />
    </main>
  );
}
