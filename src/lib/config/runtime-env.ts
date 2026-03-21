import { z } from "zod";

const blankToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());

export const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalString,
  APP_ENCRYPTION_KEY: optionalString,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  DIALIQ_APP_NAME: optionalString,
  DIALIQ_MOCK_MODE: z.preprocess(blankToUndefined, z.enum(["true", "false"]).optional()),
  OPENROUTER_API_KEY: optionalString,
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_PHONE_NUMBER: optionalString,
  DEEPGRAM_API_KEY: optionalString,
  ELEVENLABS_API_KEY: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: optionalUrl,
  CRM_API_KEY: optionalString,
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
export type ProviderKey =
  | "twilio"
  | "deepgram"
  | "openrouter"
  | "elevenlabs"
  | "google"
  | "crm";

export interface ProviderReadiness {
  key: ProviderKey;
  label: string;
  configured: boolean;
  requiredEnv: string[];
  optional: boolean;
}

export function parseRuntimeEnv(
  input: Record<string, string | undefined>,
): RuntimeEnv {
  return runtimeEnvSchema.parse(input);
}

export function readBooleanFlag(
  value: RuntimeEnv["DIALIQ_MOCK_MODE"],
  defaultValue: boolean,
) {
  if (value === undefined) {
    return defaultValue;
  }

  return value === "true";
}

export function buildProviderReadiness(input: RuntimeEnv): ProviderReadiness[] {
  return [
    {
      key: "twilio",
      label: "Twilio",
      configured: Boolean(
        input.TWILIO_ACCOUNT_SID &&
          input.TWILIO_AUTH_TOKEN &&
          input.TWILIO_PHONE_NUMBER,
      ),
      requiredEnv: [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
      ],
      optional: false,
    },
    {
      key: "deepgram",
      label: "Deepgram",
      configured: Boolean(input.DEEPGRAM_API_KEY),
      requiredEnv: ["DEEPGRAM_API_KEY"],
      optional: false,
    },
    {
      key: "openrouter",
      label: "OpenRouter",
      configured: Boolean(input.OPENROUTER_API_KEY),
      requiredEnv: ["OPENROUTER_API_KEY"],
      optional: false,
    },
    {
      key: "elevenlabs",
      label: "ElevenLabs",
      configured: Boolean(input.ELEVENLABS_API_KEY),
      requiredEnv: ["ELEVENLABS_API_KEY"],
      optional: false,
    },
    {
      key: "google",
      label: "Google Calendar",
      configured: Boolean(
        input.GOOGLE_CLIENT_ID &&
          input.GOOGLE_CLIENT_SECRET &&
          input.GOOGLE_REDIRECT_URI,
      ),
      requiredEnv: [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
      ],
      optional: true,
    },
    {
      key: "crm",
      label: "CRM",
      configured: Boolean(input.CRM_API_KEY),
      requiredEnv: ["CRM_API_KEY"],
      optional: true,
    },
  ];
}
