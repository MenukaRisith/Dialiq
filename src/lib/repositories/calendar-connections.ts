import { AppError } from "@/lib/api/route-handler";
import { env } from "@/lib/config/env";
import {
  getPrismaClient,
  isDatabaseConfigured,
  withDatabaseTimeout,
} from "@/lib/db/prisma";
import { logError } from "@/lib/observability/logger";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

export interface GoogleCalendarConnection {
  id: string;
  workspaceId: string;
  accountEmail: string | null;
  calendarId: string;
  refreshToken: string;
  scope: string[];
}

function ensureDatabaseReady() {
  if (!isDatabaseConfigured()) {
    throw new AppError("DATABASE_URL is required for Google Calendar connections.", {
      statusCode: 500,
      code: "DATABASE_NOT_CONFIGURED",
    });
  }

  if (!env.APP_ENCRYPTION_KEY) {
    throw new AppError("APP_ENCRYPTION_KEY is required for Google Calendar connections.", {
      statusCode: 500,
      code: "APP_ENCRYPTION_KEY_MISSING",
    });
  }
}

export async function resolveWorkspaceBySlug(workspaceSlug: string) {
  ensureDatabaseReady();
  const prisma = getPrismaClient();
  const workspace = await withDatabaseTimeout(
    prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    }),
    "Workspace lookup for Google Calendar",
  );

  if (!workspace) {
    throw new AppError(`Workspace "${workspaceSlug}" was not found.`, {
      statusCode: 404,
      code: "WORKSPACE_NOT_FOUND",
    });
  }

  return workspace;
}

export async function saveGoogleCalendarConnection(input: {
  workspaceSlug: string;
  refreshToken: string;
  accountEmail?: string | null;
  calendarId?: string;
  scope: string[];
}) {
  ensureDatabaseReady();
  const prisma = getPrismaClient();
  const workspace = await resolveWorkspaceBySlug(input.workspaceSlug);

  return withDatabaseTimeout(
    prisma.calendarConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: workspace.id,
          provider: "google",
        },
      },
      update: {
        accountEmail: input.accountEmail ?? null,
        calendarId: input.calendarId ?? env.GOOGLE_DEFAULT_CALENDAR_ID ?? "primary",
        encryptedRefreshToken: encryptSecret(input.refreshToken),
        scope: input.scope,
        lastValidatedAt: new Date(),
        connectedAt: new Date(),
      },
      create: {
        workspaceId: workspace.id,
        provider: "google",
        accountEmail: input.accountEmail ?? null,
        calendarId: input.calendarId ?? env.GOOGLE_DEFAULT_CALENDAR_ID ?? "primary",
        encryptedRefreshToken: encryptSecret(input.refreshToken),
        scope: input.scope,
        lastValidatedAt: new Date(),
      },
    }),
    "Google Calendar connection save",
  );
}

export async function getGoogleCalendarConnectionByWorkspaceId(workspaceId: string): Promise<GoogleCalendarConnection | null> {
  ensureDatabaseReady();
  const prisma = getPrismaClient();
  const connection = await withDatabaseTimeout(
    prisma.calendarConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: "google",
        },
      },
    }),
    "Google Calendar connection read",
  );

  if (!connection) {
    return null;
  }

  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    accountEmail: connection.accountEmail,
    calendarId: connection.calendarId,
    refreshToken: decryptSecret(connection.encryptedRefreshToken),
    scope: Array.isArray(connection.scope)
      ? connection.scope.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

export async function getGoogleCalendarConnectionStatus(workspaceSlug: string) {
  if (!isDatabaseConfigured() || !env.APP_ENCRYPTION_KEY) {
    return {
      connected: false,
      workspaceSlug,
      accountEmail: null,
      calendarId: null,
    };
  }

  try {
    const workspace = await withDatabaseTimeout(
      getPrismaClient().workspace.findUnique({
        where: { slug: workspaceSlug },
        select: { id: true },
      }),
      "Workspace lookup for Google Calendar status",
    );

    if (!workspace) {
      return {
        connected: false,
        workspaceSlug,
        accountEmail: null,
        calendarId: null,
      };
    }

    const connection = await getGoogleCalendarConnectionByWorkspaceId(workspace.id);

    return {
      connected: Boolean(connection),
      workspaceSlug,
      accountEmail: connection?.accountEmail ?? null,
      calendarId: connection?.calendarId ?? null,
    };
  } catch (error) {
    logError("google_calendar.status_failed", error, {
      workspaceSlug,
    });

    return {
      connected: false,
      workspaceSlug,
      accountEmail: null,
      calendarId: null,
    };
  }
}
