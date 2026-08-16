import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPetHomeData } from "@/services/pet-service";
import { PetHome } from "@/components/pet/pet-home";

export const metadata = { title: "Pet Home — MyPuppy" };

export default async function PetPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/signin");

  const hasPet = await prisma.pet
    .findFirst({ where: { userId: user.id, active: true }, select: { id: true } })
    .catch(() => null);
  if (!hasPet) redirect("/pet/welcome");

  const data = await getPetHomeData(user.id);
  if (!data) redirect("/pet/welcome");

  return <PetHome initial={data} user={{ email: user.email, name: user.name }} />;
}
