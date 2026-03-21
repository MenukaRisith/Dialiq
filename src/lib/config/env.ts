import "server-only";

import {
  buildProviderReadiness,
  parseRuntimeEnv,
  readBooleanFlag,
} from "@/lib/config/runtime-env";

const parsedEnv = parseRuntimeEnv(process.env);
const appUrl = parsedEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const appName = parsedEnv.DIALIQ_APP_NAME ?? "Dialiq";
const mockModeEnabled = readBooleanFlag(parsedEnv.DIALIQ_MOCK_MODE, true);

export const env = {
  ...parsedEnv,
  NEXT_PUBLIC_APP_URL: appUrl,
  DIALIQ_APP_NAME: appName,
  DIALIQ_MOCK_MODE: mockModeEnabled ? "true" : "false",
} as const;

export const appConfig = {
  name: appName,
  description:
    "Voice-first AI agents for trusted inbound business calls, bookings, and human handoff.",
  url: new URL(appUrl),
  environment: parsedEnv.NODE_ENV,
  isMockMode: mockModeEnabled,
} as const;

export const providerReadiness = buildProviderReadiness(parsedEnv);
export const coreProviderReadiness = providerReadiness.filter(
  (provider) => !provider.optional,
);
export const missingCoreProviders = coreProviderReadiness.filter(
  (provider) => !provider.configured,
);
