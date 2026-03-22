import {
  AuditLevel,
  CredentialProvider,
  ProviderCredentialStatus,
} from "@prisma/client";

import { AppError } from "@/lib/api/route-handler";
import { env } from "@/lib/config/env";
import {
  getDatabaseHealth,
  getPrismaClient,
  isDatabaseConfigured,
  withDatabaseTimeout,
} from "@/lib/db/prisma";
import { logError } from "@/lib/observability/logger";
import {
  findProviderCatalogEntry,
  findProviderFieldEntry,
  providerCatalog,
  providerFieldCatalog,
  type ProviderCode,
  type ProviderConfigKey,
} from "@/lib/provider-catalog";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "@/lib/security/encryption";
import type { HealthStatus, ProviderCredential } from "@/lib/types";

const coreProviderKeys = new Set(["twilio", "deepgram", "openrouter", "elevenlabs"]);
const RUNTIME_CONFIG_CACHE_TTL_MS = 10_000;

const environmentValueReaders: Record<ProviderConfigKey, () => string | undefined> = {
  OPENROUTER_API_KEY: () => env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: () => env.OPENROUTER_MODEL,
  TWILIO_ACCOUNT_SID: () => env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: () => env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: () => env.TWILIO_PHONE_NUMBER,
  DEEPGRAM_API_KEY: () => env.DEEPGRAM_API_KEY,
  ELEVENLABS_API_KEY: () => env.ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID: () => env.ELEVENLABS_VOICE_ID,
  ELEVENLABS_MODEL_ID: () => env.ELEVENLABS_MODEL_ID,
  GOOGLE_CLIENT_ID: () => env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: () => env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: () => env.GOOGLE_REDIRECT_URI,
  GOOGLE_DEFAULT_CALENDAR_ID: () => env.GOOGLE_DEFAULT_CALENDAR_ID,
  CRM_API_KEY: () => env.CRM_API_KEY,
};

interface ProviderCredentialRecord {
  id: string;
  provider: CredentialProvider;
  environment: string;
  configKey: string;
  purpose: string;
  encryptedValue: string;
  maskedValue: string;
  isEnabled: boolean;
  status: ProviderCredentialStatus;
  validationMessage: string | null;
  lastValidatedAt: Date | null;
  nextRotationAt: Date | null;
  rotatedAt: Date | null;
}

interface ResolvedRuntimeConfig {
  values: Map<ProviderConfigKey, string>;
  sources: Map<ProviderConfigKey, "database" | "environment">;
}

let runtimeConfigCache:
  | {
      expiresAt: number;
      data: ResolvedRuntimeConfig;
    }
  | undefined;

function clearRuntimeConfigCache() {
  runtimeConfigCache = undefined;
}

function getEnvironmentValue(key: ProviderConfigKey) {
  return environmentValueReaders[key]();
}

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

function normalizeConfigKey(
  provider: CredentialProvider | ProviderCode,
  configKey: string,
): ProviderConfigKey | null {
  const catalog = findProviderCatalogEntry(provider as ProviderCode);

  if (!catalog) {
    return null;
  }

  const directField = catalog.fields.find((field) => field.key === configKey);
  if (directField) {
    return directField.key;
  }

  if (configKey === "DEFAULT") {
    const requiredFields = catalog.fields.filter((field) => field.required);
    if (requiredFields.length === 1) {
      return requiredFields[0].key;
    }
  }

  return null;
}

function sortCredentials(left: ProviderCredential, right: ProviderCredential) {
  if (left.provider !== right.provider) {
    return left.provider.localeCompare(right.provider);
  }

  return left.configKey.localeCompare(right.configKey);
}

function buildEnvironmentCredentials(): ProviderCredential[] {
  return providerFieldCatalog
    .map((field) => {
      const configuredValue = getEnvironmentValue(field.key);
      const configured = Boolean(configuredValue);

      return {
        id: `env-${field.key}`,
        provider: field.providerLabel,
        configKey: field.key,
        purpose: `${field.label} • ${field.providerPurpose}`,
        status: mapConfiguredStatus(configured, !field.required),
        maskedValue: configured
          ? field.secret
            ? "Managed in runtime environment"
            : maskSecret(configuredValue ?? "")
          : "Not configured in runtime environment",
        environment: "Runtime environment",
        lastValidated: "Process startup",
        nextRotation: "Rotate outside app",
        source: "environment",
        isEnabled: configured,
        validationMessage: configured
          ? null
          : field.required
            ? `${field.key} is not configured in either MySQL or environment variables.`
            : `${field.key} is optional and not configured yet.`,
      } satisfies ProviderCredential;
    })
    .sort(sortCredentials);
}

function mapRecord(record: ProviderCredentialRecord): ProviderCredential {
  const fieldKey = normalizeConfigKey(record.provider, record.configKey);
  const field = fieldKey ? findProviderFieldEntry(fieldKey) : null;
  const catalog = findProviderCatalogEntry(record.provider as ProviderCode);

  return {
    id: record.id,
    provider: catalog?.label ?? record.provider,
    configKey: fieldKey ?? record.configKey,
    purpose: record.purpose || `${field?.label ?? "Credential"} • ${catalog?.purpose ?? "Provider config"}`,
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

function mergeCredentials(records: ProviderCredentialRecord[]) {
  const databaseCredentials = records.map(mapRecord);
  const coveredKeys = new Set(
    records
      .map((record) => normalizeConfigKey(record.provider, record.configKey))
      .filter((value): value is ProviderConfigKey => Boolean(value)),
  );
  const environmentFallbacks = buildEnvironmentCredentials().filter(
    (credential) => !coveredKeys.has(credential.configKey as ProviderConfigKey),
  );

  return [...databaseCredentials, ...environmentFallbacks].sort(sortCredentials);
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
  source: "database" | "environment" | "mixed";
  status: HealthStatus;
  validationMessage?: string | null;
}

export interface SaveProviderCredentialInput {
  provider: ProviderCode;
  configKey: ProviderConfigKey;
  environment: string;
  purpose: string;
  value?: string;
  nextRotationAt?: string | null;
  enabled: boolean;
  actor?: string;
}

async function readDatabaseRecords() {
  if (!isDatabaseConfigured()) {
    return [] as ProviderCredentialRecord[];
  }

  const prisma = getPrismaClient();
  return withDatabaseTimeout(
    prisma.providerCredential.findMany({
      orderBy: [{ provider: "asc" }, { configKey: "asc" }, { environment: "asc" }],
    }),
    "Provider credential read",
  );
}

async function loadResolvedRuntimeConfig(forceFresh = false): Promise<ResolvedRuntimeConfig> {
  if (!forceFresh && runtimeConfigCache && runtimeConfigCache.expiresAt > Date.now()) {
    return runtimeConfigCache.data;
  }

  const values = new Map<ProviderConfigKey, string>();
  const sources = new Map<ProviderConfigKey, "database" | "environment">();

  for (const field of providerFieldCatalog) {
    const envValue = getEnvironmentValue(field.key);
    if (envValue) {
      values.set(field.key, envValue);
      sources.set(field.key, "environment");
    }
  }

  if (isDatabaseConfigured()) {
    try {
      const records = await readDatabaseRecords();
      const preferredRecords = new Map<ProviderConfigKey, ProviderCredentialRecord>();

      for (const record of records) {
        const fieldKey = normalizeConfigKey(record.provider, record.configKey);
        if (!fieldKey) {
          continue;
        }

        const existing = preferredRecords.get(fieldKey);
        const nextEnvironment = record.environment.trim().toLowerCase();
        const existingEnvironment = existing?.environment.trim().toLowerCase();

        if (
          !existing ||
          (nextEnvironment === "production" && existingEnvironment !== "production")
        ) {
          preferredRecords.set(fieldKey, record);
        }
      }

      for (const record of preferredRecords.values()) {
        if (!record.isEnabled) {
          continue;
        }

        const fieldKey = normalizeConfigKey(record.provider, record.configKey);
        if (!fieldKey) {
          continue;
        }

        try {
          const decryptedValue = decryptSecret(record.encryptedValue);
          if (decryptedValue) {
            values.set(fieldKey, decryptedValue);
            sources.set(fieldKey, "database");
          }
        } catch (error) {
          logError("provider_credentials.decrypt_failed", error, {
            provider: record.provider,
            configKey: record.configKey,
          });
        }
      }
    } catch (error) {
      logError("provider_credentials.runtime_read_failed", error, {});
    }
  }

  const data = {
    values,
    sources,
  };
  runtimeConfigCache = {
    expiresAt: Date.now() + RUNTIME_CONFIG_CACHE_TTL_MS,
    data,
  };

  return data;
}

export async function resolveProviderConfigValue(key: ProviderConfigKey) {
  const resolved = await loadResolvedRuntimeConfig();
  return resolved.values.get(key);
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
    const records = await readDatabaseRecords();

    return {
      credentials: records.length > 0 ? mergeCredentials(records) : environmentCredentials,
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
  const resolved = await loadResolvedRuntimeConfig();

  return providerCatalog.map((provider) => {
    const requiredFields = provider.fields.filter((field) => field.required);
    const configuredFields = requiredFields.filter((field) =>
      Boolean(resolved.values.get(field.key)),
    );
    const configured = configuredFields.length === requiredFields.length;
    const sourceSet = new Set(
      configuredFields
        .map((field) => resolved.sources.get(field.key))
        .filter((source): source is "database" | "environment" => Boolean(source)),
    );
    const source =
      sourceSet.size > 1
        ? "mixed"
        : sourceSet.has("database")
          ? "database"
          : "environment";

    return {
      key: provider.healthKey,
      label: provider.label,
      configured,
      optional: provider.optional,
      requiredEnv: requiredFields.map((field) => field.key),
      source,
      status: configured ? "healthy" : provider.optional ? "inactive" : "warning",
      validationMessage: configured
        ? null
        : `Missing ${requiredFields
            .filter((field) => !resolved.values.get(field.key))
            .map((field) => field.key)
            .join(", ")}.`,
    };
  });
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

  const providerCatalogEntry = findProviderCatalogEntry(input.provider);
  const fieldEntry = findProviderFieldEntry(input.configKey);

  if (!providerCatalogEntry || !fieldEntry || fieldEntry.provider !== input.provider) {
    throw new AppError("Provider config key does not belong to the selected provider.", {
      statusCode: 400,
      code: "INVALID_PROVIDER_CONFIG_KEY",
    });
  }

  const prisma = getPrismaClient();
  const provider = input.provider as CredentialProvider;
  const environment = input.environment.trim() || "Production";

  const existing = await withDatabaseTimeout(
    prisma.providerCredential.findUnique({
      where: {
        provider_environment_configKey: {
          provider,
          environment,
          configKey: input.configKey,
        },
      },
    }),
    "Provider credential lookup",
  );

  const nextValue = input.value?.trim();
  const encryptedValue =
    nextValue && nextValue.length > 0
      ? encryptSecret(nextValue)
      : existing?.encryptedValue;
  const maskedValue =
    nextValue && nextValue.length > 0 ? maskSecret(nextValue) : existing?.maskedValue;

  if (!encryptedValue || !maskedValue) {
    throw new AppError("A value is required for new provider config entries.", {
      statusCode: 400,
      code: "PROVIDER_VALUE_REQUIRED",
    });
  }

  const purpose =
    input.purpose.trim() || `${fieldEntry.label} • ${providerCatalogEntry.purpose}`;

  const record = await withDatabaseTimeout(
    prisma.providerCredential.upsert({
      where: {
        provider_environment_configKey: {
          provider,
          environment,
          configKey: input.configKey,
        },
      },
      update: {
        configKey: input.configKey,
        purpose,
        encryptedValue,
        maskedValue,
        isEnabled: input.enabled,
        status: input.enabled
          ? ProviderCredentialStatus.HEALTHY
          : ProviderCredentialStatus.INACTIVE,
        validationMessage: null,
        lastValidatedAt: new Date(),
        nextRotationAt: input.nextRotationAt ? new Date(input.nextRotationAt) : null,
        rotatedAt: new Date(),
      },
      create: {
        provider,
        environment,
        configKey: input.configKey,
        purpose,
        encryptedValue,
        maskedValue,
        isEnabled: input.enabled,
        status: input.enabled
          ? ProviderCredentialStatus.HEALTHY
          : ProviderCredentialStatus.INACTIVE,
        validationMessage: null,
        lastValidatedAt: new Date(),
        nextRotationAt: input.nextRotationAt ? new Date(input.nextRotationAt) : null,
        rotatedAt: new Date(),
      },
    }),
    "Provider credential save",
  );

  await withDatabaseTimeout(
    prisma.auditLog.create({
      data: {
        actor: input.actor ?? "Platform admin",
        action: existing ? "Updated provider config" : "Created provider config",
        target: `${providerCatalogEntry.label} ${input.configKey} (${environment})`,
        level: AuditLevel.INFO,
        providerCredentialId: record.id,
        details: {
          source: "admin-panel",
          configKey: input.configKey,
        },
      },
    }),
    "Provider credential audit write",
  );

  clearRuntimeConfigCache();
  return mapRecord(record);
}

export async function toggleProviderCredential(
  id: string,
  enabled: boolean,
  actor = "Platform admin",
) {
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
        actor,
        action: enabled ? "Enabled provider config" : "Disabled provider config",
        target: `${record.provider} ${record.configKey} (${record.environment})`,
        level: AuditLevel.INFO,
        providerCredentialId: record.id,
      },
    }),
    "Provider credential toggle audit write",
  );

  clearRuntimeConfigCache();
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
