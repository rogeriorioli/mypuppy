import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { buildPgConnectionOptions } from "../src/lib/db-connection.ts";
import bcrypt from "bcryptjs";

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  const adapter = new PrismaPg(buildPgConnectionOptions(connectionString));
  return new PrismaClient({ adapter });
}

const prisma = createClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.upsert({
    where: { email: "demo@dogday.dev" },
    update: {},
    create: { email: "demo@dogday.dev", name: "Demo", passwordHash },
  });
  console.log(`Seeded demo user id=${user.id} email=demo@dogday.dev password=password123`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
