import "server-only";

import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/config/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function isDatabaseConfigured() {
  return Boolean(env.DATABASE_URL);
}

export function getPrismaClient() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalForPrisma.prisma;
}

export async function getDatabaseHealth() {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      reachable: false,
      error: null,
    };
  }

  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;

    return {
      configured: true,
      reachable: true,
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown database error.",
    };
  }
}
