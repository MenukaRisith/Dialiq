export const providerCatalog = [
  {
    value: "OPENROUTER",
    label: "OpenRouter",
    purpose: "LLM routing for gpt-5.4-mini",
    healthKey: "openrouter",
    optional: false,
    fields: [
      {
        key: "OPENROUTER_API_KEY",
        label: "API key",
        secret: true,
        required: true,
      },
      {
        key: "OPENROUTER_MODEL",
        label: "Model",
        secret: false,
        required: false,
      },
    ],
  },
  {
    value: "TWILIO",
    label: "Twilio",
    purpose: "Inbound telephony and WhatsApp calling",
    healthKey: "twilio",
    optional: false,
    fields: [
      {
        key: "TWILIO_ACCOUNT_SID",
        label: "Account SID",
        secret: true,
        required: true,
      },
      {
        key: "TWILIO_AUTH_TOKEN",
        label: "Auth token",
        secret: true,
        required: true,
      },
      {
        key: "TWILIO_PHONE_NUMBER",
        label: "Phone number",
        secret: false,
        required: true,
      },
    ],
  },
  {
    value: "DEEPGRAM",
    label: "Deepgram",
    purpose: "Flux streaming speech-to-text",
    healthKey: "deepgram",
    optional: false,
    fields: [
      {
        key: "DEEPGRAM_API_KEY",
        label: "API key",
        secret: true,
        required: true,
      },
    ],
  },
  {
    value: "ELEVENLABS",
    label: "ElevenLabs",
    purpose: "Voice synthesis for answer playback",
    healthKey: "elevenlabs",
    optional: false,
    fields: [
      {
        key: "ELEVENLABS_API_KEY",
        label: "API key",
        secret: true,
        required: true,
      },
      {
        key: "ELEVENLABS_VOICE_ID",
        label: "Voice ID",
        secret: false,
        required: false,
      },
      {
        key: "ELEVENLABS_MODEL_ID",
        label: "Model ID",
        secret: false,
        required: false,
      },
    ],
  },
  {
    value: "GOOGLE",
    label: "Google Calendar",
    purpose: "Calendar OAuth and booking actions",
    healthKey: "google",
    optional: true,
    fields: [
      {
        key: "GOOGLE_CLIENT_ID",
        label: "Client ID",
        secret: true,
        required: true,
      },
      {
        key: "GOOGLE_CLIENT_SECRET",
        label: "Client secret",
        secret: true,
        required: true,
      },
      {
        key: "GOOGLE_REDIRECT_URI",
        label: "Redirect URI",
        secret: false,
        required: true,
      },
      {
        key: "GOOGLE_DEFAULT_CALENDAR_ID",
        label: "Default calendar ID",
        secret: false,
        required: false,
      },
    ],
  },
  {
    value: "CRM",
    label: "CRM",
    purpose: "Lead and CRM sync",
    healthKey: "crm",
    optional: true,
    fields: [
      {
        key: "CRM_API_KEY",
        label: "API key",
        secret: true,
        required: false,
      },
    ],
  },
] as const;

export type ProviderCatalogEntry = (typeof providerCatalog)[number];
export type ProviderCode = ProviderCatalogEntry["value"];
export type ProviderFieldCatalogEntry = ProviderCatalogEntry["fields"][number];
export type ProviderConfigKey = ProviderFieldCatalogEntry["key"];

export const providerFieldCatalog = providerCatalog.flatMap((provider) =>
  provider.fields.map((field) => ({
    provider: provider.value,
    providerLabel: provider.label,
    providerPurpose: provider.purpose,
    key: field.key,
    label: field.label,
    secret: field.secret,
    required: field.required,
  })),
) as Array<{
  provider: ProviderCode;
  providerLabel: string;
  providerPurpose: string;
  key: ProviderConfigKey;
  label: string;
  secret: boolean;
  required: boolean;
}>;

export function findProviderCatalogEntry(provider: ProviderCode) {
  return providerCatalog.find((entry) => entry.value === provider);
}

export function findProviderFieldEntry(key: ProviderConfigKey) {
  return providerFieldCatalog.find((entry) => entry.key === key);
}
