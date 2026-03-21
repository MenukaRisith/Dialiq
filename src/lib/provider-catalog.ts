export const providerCatalog = [
  {
    value: "OPENROUTER",
    label: "OpenRouter",
    purpose: "LLM routing for gpt-5.4-mini",
    healthKey: "openrouter",
  },
  {
    value: "TWILIO",
    label: "Twilio",
    purpose: "Inbound telephony and WhatsApp calling",
    healthKey: "twilio",
  },
  {
    value: "DEEPGRAM",
    label: "Deepgram",
    purpose: "Flux streaming speech-to-text",
    healthKey: "deepgram",
  },
  {
    value: "ELEVENLABS",
    label: "ElevenLabs",
    purpose: "Voice synthesis for answer playback",
    healthKey: "elevenlabs",
  },
  {
    value: "GOOGLE",
    label: "Google Calendar",
    purpose: "Calendar OAuth and booking actions",
    healthKey: "google",
  },
  {
    value: "CRM",
    label: "CRM",
    purpose: "Lead and CRM sync",
    healthKey: "crm",
  },
] as const;

export type ProviderCatalogEntry = (typeof providerCatalog)[number];
export type ProviderCode = ProviderCatalogEntry["value"];
