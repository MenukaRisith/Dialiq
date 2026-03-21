import {
  AuditLevel,
  CredentialProvider,
  ProviderCredentialStatus,
} from "@prisma/client";

import { AppError } from "@/lib/api/route-handler";
import { env, providerReadiness as envProviderReadiness } from "@/lib/config/env";
import {
  getDatabaseHealth,
  getPrismaClient,
  isDatabaseConfigured,
  withDatabaseTimeout,
} from "@/lib/db/prisma";
import { logError } from "@/lib/observability/logger";
import { providerCatalog, type ProviderCode } from "@/lib/provider-catalog";
import { encryptSecret, maskSecret } from "@/lib/security/encryption";
import type { HealthStatus, ProviderCredential } from "@/lib/types";

const coreProviderKeys = new Set(["twilio", "deepgram", "openrouter", "elevenlabs"]);

function mapPrismaStatus(status: ProviderCredentialStatus, enabled: boolean): HealthStatus {
  if (!enabled || status === ProviderCredentialStatus.INACTIVE) {
    return "inactive";
  }

  if (status === ProviderCredentialStatus.CRITICAL) {
    return "critical";
  }

  if (status === ProviderCredentialStatus.WARNING) {
    return "warning";
  }

  return "healthy";
}

function mapConfiguredStatus(configured: boolean, optional: boolean): HealthStatus {
  if (configured) {
    return "healthy";
  }

  return optional ? "inactive" : "warning";
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function findCatalogEntry(provider: ProviderCode | CredentialProvider) {
  return providerCatalog.find((entry) => entry.value === provider);
}

function buildEnvironmentCredentials(): ProviderCredential[] {
  return envProviderReadiness.map((provider) => {
    const catalog = providerCatalog.find(
      (entry) => entry.healthKey === provider.key,
    );
    const status = mapConfiguredStatus(provider.configured, provider.optional);

    return {
      id: `env-${provider.key}`,
      provider: catalog?.label ?? provider.label,
      purpose: catalog?.purpose ?? `${provider.label} provider credential`,
      status,
      maskedValue: provider.configured
        ? "Managed in runtime environment"
        : "Not configured in runtime environment",
      environment: "Runtime environment",
      lastValidated: "Process startup",
      nextRotation: "Rotate outside app",
      source: "environment",
      isEnabled: provider.configured,
      validationMessage: provider.configured
        ? null
        : provider.optional
          ? "Optional provider is not configured yet."
          : "Required provider is not configured in either MySQL or environment variables.",
    };
  });
}

function mapRecord(record: {
  id: string;
  provider: CredentialProvider;
  purpose: string;
  environment: string;
  maskedValue: string;
  isEnabled: boolean;
  status: ProviderCredentialStatus;
  lastValidatedAt: Date | null;
  nextRotationAt: Date | null;
  validationMessage: string | null;
}): ProviderCredential {
  const catalog = findCatalogEntry(record.provider);

  return {
    id: record.id,
    provider: catalog?.label ?? record.provider,
    purpose: record.purpose,
    status: mapPrismaStatus(record.status, record.isEnabled),
    maskedValue: record.maskedValue,
    environment: record.environment,
    lastValidated: formatDate(record.lastValidatedAt),
    nextRotation: formatDate(record.nextRotationAt),
    source: "database",
    isEnabled: record.isEnabled,
    validationMessage: record.validationMessage,
  };
}

export interface ProviderCredentialDashboardData {
  credentials: ProviderCredential[];
  database: {
    configured: boolean;
    reachable: boolean;
    mode: "database" | "fallback";
    error: string | null;
  };
}

export interface ResolvedProviderReadiness {
  key: string;
  label: string;
  configured: boolean;
  optional: boolean;
  requiredEnv: string[];
  source: "database" | "environment";
  status: HealthStatus;
  validationMessage?: string | null;
}

export interface SaveProviderCredentialInput {
  provider: ProviderCode;
  environment: string;
  purpose: string;
  secret?: string;
  nextRotationAt?: string | null;
  enabled: boolean;
  actor?: string;
}

export async function listProviderCredentialsDashboard(): Promise<ProviderCredentialDashboardData> {
  const environmentCredentials = buildEnvironmentCredentials();

  if (!isDatabaseConfigured()) {
    return {
      credentials: environmentCredentials,
      database: {
        configured: false,
        reachable: false,
        mode: "fallback",
        error: null,
      },
    };
  }

  try {
    const prisma = getPrismaClient();
    const records = await withDatabaseTimeout(
      prisma.providerCredential.findMany({
        orderBy: [{ provider: "asc" }, { environment: "asc" }],
      }),
      "Provider credential dashboard read",
    );

    if (records.length === 0) {
      return {
        credentials: environmentCredentials,
        database: {
          configured: true,
          reachable: true,
          mode: "database",
          error: null,
        },
      };
    }

    return {
      credentials: records.map(mapRecord),
      database: {
        configured: true,
        reachable: true,
        mode: "database",
        error: null,
      },
    };
  } catch (error) {
    logError("provider_credentials.list_failed", error, {});

    return {
      credentials: environmentCredentials,
      database: {
        configured: true,
        reachable: false,
        mode: "fallback",
        error: error instanceof Error ? error.message : "Unknown database error.",
      },
    };
  }
}

export async function getResolvedProviderReadiness(): Promise<ResolvedProviderReadiness[]> {
  if (!isDatabaseConfigured()) {
    return envProviderReadiness.map((provider) => ({
      ...provider,
      source: "environment",
      status: provider.configured
        ? "healthy"
        : provider.optional
          ? "inactive"
          : "warning",
    }));
  }

  try {
    const prisma = getPrismaClient();
    const records = await withDatabaseTimeout(
      prisma.providerCredential.findMany(),
      "Provider readiness resolution",
    );

    return envProviderReadiness.map((provider) => {
      const catalog = providerCatalog.find(
        (entry) => entry.healthKey === provider.key,
      );
      const match = records.find((record) => record.provider === catalog?.value);

      if (!match) {
        return {
          ...provider,
          source: "environment",
          status: provider.configured
            ? "healthy"
            : provider.optional
              ? "inactive"
              : "warning",
        };
      }

      const configured = match.isEnabled && Boolean(match.encryptedValue);

      return {
        key: provider.key,
        label: provider.label,
        configured,
        optional: provider.optional,
        requiredEnv: provider.requiredEnv,
        source: "database",
        status: mapPrismaStatus(match.status, match.isEnabled),
        validationMessage: match.validationMessage,
      };
    });
  } catch (error) {
    logError("provider_credentials.resolve_failed", error, {});

    return envProviderReadiness.map((provider) => ({
      ...provider,
      source: "environment",
      status: provider.configured
        ? "healthy"
        : provider.optional
          ? "inactive"
          : "warning",
    }));
  }
}

export async function getMissingCoreProviders() {
  const readiness = await getResolvedProviderReadiness();
  return readiness.filter(
    (provider) => coreProviderKeys.has(provider.key) && !provider.configured,
  );
}

export async function saveProviderCredential(input: SaveProviderCredentialInput) {
  if (!isDatabaseConfigured()) {
    throw new AppError("DATABASE_URL is not configured.", {
      statusCode: 500,
      code: "DATABASE_NOT_CONFIGURED",
    });
  }

  if (!env.APP_ENCRYPTION_KEY) {
    throw new AppError("APP_ENCRYPTION_KEY is required before storing secrets.", {
      statusCode: 500,
      code: "APP_ENCRYPTION_KEY_MISSING",
    });
  }

  const prisma = getPrismaClient();
  const provider = input.provider as CredentialProvider;
  const environment = input.environment.trim() || "Production";
  const catalog = findCatalogEntry(provider);

  const existing = await withDatabaseTimeout(
    prisma.providerCredential.findUnique({
      where: {
        provider_environment: {
          provider,
          environment,
        },
      },
    }),
    "Provider credential lookup",
  );

  const secret = input.secret?.trim();
  const encryptedValue =
    secret && secret.length > 0
      ? encryptSecret(secret)
      : existing?.encryptedValue;
  const maskedValue =
    secret && secret.length > 0 ? maskSecret(secret) : existing?.maskedValue;

  if (!encryptedValue || !maskedValue) {
    throw new AppError("A secret value is required for new provider credentials.", {
      statusCode: 400,
      code: "SECRET_REQUIRED",
    });
  }

  const record = await withDatabaseTimeout(
    prisma.providerCredential.upsert({
      where: {
        provider_environment: {
          provider,
          environment,
        },
      },
      update: {
        purpose: input.purpose.trim() || catalog?.purpose || "Provider credential",
        encryptedValue,
        maskedValue,
        isEnabled: input.enabled,
        status: input.enabled
          ? ProviderCredentialStatus.HEALTHY
          : ProviderCredentialStatus.INACTIVE,
        validationMessage: null,
        lastValidatedAt: new Date(),
        nextRotationAt: input.nextRotationAt
          ? new Date(input.nextRotationAt)
          : null,
        rotatedAt: new Date(),
      },
      create: {
        provider,
        environment,
        purpose: input.purpose.trim() || catalog?.purpose || "Provider credential",
        encryptedValue,
        maskedValue,
        isEnabled: input.enabled,
        status: input.enabled
          ? ProviderCredentialStatus.HEALTHY
          : ProviderCredentialStatus.INACTIVE,
        lastValidatedAt: new Date(),
        nextRotationAt: input.nextRotationAt
          ? new Date(input.nextRotationAt)
          : null,
        rotatedAt: new Date(),
      },
    }),
    "Provider credential save",
  );

  await withDatabaseTimeout(
    prisma.auditLog.create({
      data: {
        actor: input.actor ?? "Platform admin",
        action: existing ? "Updated provider credential" : "Created provider credential",
        target: `${catalog?.label ?? provider} (${environment})`,
        level: AuditLevel.INFO,
        providerCredentialId: record.id,
        details: {
          source: "admin-panel",
        },
      },
    }),
    "Provider credential audit write",
  );

  return mapRecord(record);
}

export async function toggleProviderCredential(id: string, enabled: boolean) {
  if (!isDatabaseConfigured()) {
    throw new AppError("DATABASE_URL is not configured.", {
      statusCode: 500,
      code: "DATABASE_NOT_CONFIGURED",
    });
  }

  const prisma = getPrismaClient();
  const record = await withDatabaseTimeout(
    prisma.providerCredential.update({
      where: { id },
      data: {
        isEnabled: enabled,
        status: enabled
          ? ProviderCredentialStatus.HEALTHY
          : ProviderCredentialStatus.INACTIVE,
        lastValidatedAt: new Date(),
      },
    }),
    "Provider credential toggle",
  );

  await withDatabaseTimeout(
    prisma.auditLog.create({
      data: {
        actor: "Platform admin",
        action: enabled ? "Enabled provider credential" : "Disabled provider credential",
        target: `${record.provider} (${record.environment})`,
        level: AuditLevel.INFO,
        providerCredentialId: record.id,
      },
    }),
    "Provider credential toggle audit write",
  );

  return mapRecord(record);
}

export async function getOperationalReadiness() {
  const [database, providers] = await Promise.all([
    getDatabaseHealth(),
    getResolvedProviderReadiness(),
  ]);

  return {
    database,
    providers,
  };
}
