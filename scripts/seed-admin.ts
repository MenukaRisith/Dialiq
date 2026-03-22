import { getPrismaClient, withDatabaseTimeout } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() || "Platform Admin";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  const prisma = getPrismaClient();
  const passwordHash = hashPassword(password);

  const user = await withDatabaseTimeout(
    prisma.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
      create: {
        email,
        name,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    }),
    "Admin user seed",
  );

  console.log(`Admin user ready: ${user.email}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
