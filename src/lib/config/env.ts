import {
  buildProviderReadiness,
  parseRuntimeEnv,
  readBooleanFlag,
} from "@/lib/config/runtime-env";

function clampTimeout(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const resolved = value ?? fallback;
  return Math.min(Math.max(resolved, minimum), maximum);
}

const parsedEnv = parseRuntimeEnv(process.env);
const appUrl = parsedEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const appName = parsedEnv.DIALIQ_APP_NAME ?? "Dialiq";
const mockModeEnabled = readBooleanFlag(parsedEnv.DIALIQ_MOCK_MODE, true);
const insecureTwilioSignatureAllowed = readBooleanFlag(
  parsedEnv.DIALIQ_ALLOW_INSECURE_TWILIO_SIGNATURE,
  mockModeEnabled,
);
const databaseTimeoutMs = clampTimeout(
  parsedEnv.DIALIQ_DATABASE_TIMEOUT_MS,
  1500,
  250,
  10000,
);
const providerConnectTimeoutMs = clampTimeout(
  parsedEnv.DIALIQ_PROVIDER_CONNECT_TIMEOUT_MS,
  1500,
  250,
  10000,
);
const reasoningTimeoutMs = clampTimeout(
  parsedEnv.DIALIQ_REASONING_TIMEOUT_MS,
  2500,
  500,
  10000,
);

export const env = {
  ...parsedEnv,
  NEXT_PUBLIC_APP_URL: appUrl,
  DIALIQ_APP_NAME: appName,
  DIALIQ_MOCK_MODE: mockModeEnabled ? "true" : "false",
  DIALIQ_ALLOW_INSECURE_TWILIO_SIGNATURE: insecureTwilioSignatureAllowed
    ? "true"
    : "false",
  DIALIQ_DATABASE_TIMEOUT_MS: databaseTimeoutMs,
  DIALIQ_PROVIDER_CONNECT_TIMEOUT_MS: providerConnectTimeoutMs,
  DIALIQ_REASONING_TIMEOUT_MS: reasoningTimeoutMs,
} as const;

export const appConfig = {
  name: appName,
  description:
    "Voice-first AI agents for trusted inbound business calls, bookings, and human handoff.",
  url: new URL(appUrl),
  environment: parsedEnv.NODE_ENV,
  isMockMode: mockModeEnabled,
  isInsecureTwilioSignatureAllowed: insecureTwilioSignatureAllowed,
  databaseTimeoutMs,
  providerConnectTimeoutMs,
  reasoningTimeoutMs,
} as const;

export const providerReadiness = buildProviderReadiness(parsedEnv);
export const coreProviderReadiness = providerReadiness.filter(
  (provider) => !provider.optional,
);
export const missingCoreProviders = coreProviderReadiness.filter(
  (provider) => !provider.configured,
);
