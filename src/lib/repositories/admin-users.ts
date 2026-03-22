import { AppError } from "@/lib/api/route-handler";
import {
  getPrismaClient,
  isDatabaseConfigured,
  withDatabaseTimeout,
} from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  passwordHash: string | null;
  isActive: boolean;
}

function ensureDatabase() {
  if (!isDatabaseConfigured()) {
    throw new AppError("DATABASE_URL is required for admin auth.", {
      statusCode: 500,
      code: "DATABASE_NOT_CONFIGURED",
    });
  }
}

export async function findActiveAdminUserById(id: string): Promise<AdminUserRecord | null> {
  ensureDatabase();
  const prisma = getPrismaClient();

  const user = await withDatabaseTimeout(
    prisma.user.findUnique({
      where: { id },
    }),
    "Admin user lookup by id",
  );

  if (!user || !user.isActive || !user.role.toUpperCase().includes("ADMIN")) {
    return null;
  }

  return user;
}

export async function findActiveAdminUserByEmail(
  email: string,
): Promise<AdminUserRecord | null> {
  ensureDatabase();
  const prisma = getPrismaClient();

  const user = await withDatabaseTimeout(
    prisma.user.findUnique({
      where: { email },
    }),
    "Admin user lookup by email",
  );

  if (!user || !user.isActive || !user.role.toUpperCase().includes("ADMIN")) {
    return null;
  }

  return user;
}

export async function authenticateAdminUser(email: string, password: string) {
  const user = await findActiveAdminUserByEmail(email.trim().toLowerCase());

  if (!user?.passwordHash) {
    return null;
  }

  return verifyPassword(password, user.passwordHash) ? user : null;
}
