import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/pet");

  return (
    <main className="shell onboarding landing">
      <div className="brand-mark">
        My<span>Puppy</span>
      </div>
      <div className="eyebrow">Made in Brazil. Raised by you.</div>
      <h1>Meet the dog who will make your day.</h1>
      <p className="lede">
        Adopt a little Brazilian dog with a big personality. Feed, play, Rolê, Cafuné. No pet ever dies — just good
        days together.
      </p>
      <div className="hero-dog" aria-hidden="true">
        <span className="sun" />
        <span className="dog-emoji">🐕</span>
        <span className="spark spark-one">✦</span>
        <span className="spark spark-two">✷</span>
      </div>
      <ul className="landing-dogs" aria-label="Meet the dogs">
        <li>
          <strong>Caramelo</strong>
          <small>Friendly, clever, adventurous.</small>
        </li>
        <li>
          <strong>Fiapo de Manga</strong>
          <small>Dramatic, affectionate, chaotic.</small>
        </li>
        <li>
          <strong>Malhadinho</strong>
          <small>Playful, curious, on permanent watch.</small>
        </li>
      </ul>
      <Link href="/signup" className="primary-button">
        Adopt your dog <span>→</span>
      </Link>
      <Link href="/signin" className="ghost-button">
        I already have a dog
      </Link>
      <p className="fine-print">No pressure. No deadlines. Just a friend who is always happy to see you.</p>
    </main>
  );
}
