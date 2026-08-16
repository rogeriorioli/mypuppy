import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MeetDog } from "@/components/pet/adopt-form";

export const metadata = { title: "Meet your dog — MyPuppy" };

const EMOJI: Record<string, string> = { caramelo: "🐕", fiapo: "🐶", malhadinho: "🐕‍🦺" };

export default async function MeetPage(props: { searchParams: Promise<{ petId?: string }> }) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/signin");

  const searchParams = await props.searchParams;
  const pet = await prisma.pet
    .findFirst({ where: { id: searchParams.petId ?? "", userId: user.id }, select: { id: true, name: true, archetype: true } })
    .catch(() => null);

  const fallback = await prisma.pet
    .findFirst({ where: { userId: user.id, active: true }, select: { id: true, name: true, archetype: true } })
    .catch(() => null);

  const target = pet ?? fallback;
  if (!target) redirect("/pet/welcome");

  return (
    <MeetDog petName={target.name} emoji={EMOJI[target.archetype] ?? "🐕"}>
      <Link href="/pet" className="primary-button">
        Go home with {target.name} <span>→</span>
      </Link>
      <p className="fine-print">Tip: enable notifications in Settings so {target.name} can reach you.</p>
    </MeetDog>
  );
}
