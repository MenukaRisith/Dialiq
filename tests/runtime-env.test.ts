import { describe, expect, it } from "vitest";

import {
  buildProviderReadiness,
  parseRuntimeEnv,
  readBooleanFlag,
} from "@/lib/config/runtime-env";

describe("runtime env parsing", () => {
  it("normalizes blank values to undefined", () => {
    const parsed = parseRuntimeEnv({
      NODE_ENV: "development",
      OPENROUTER_API_KEY: "   ",
      DEEPGRAM_API_KEY: "",
    });

    expect(parsed.OPENROUTER_API_KEY).toBeUndefined();
    expect(parsed.DEEPGRAM_API_KEY).toBeUndefined();
  });

  it("builds provider readiness from connected credentials", () => {
    const parsed = parseRuntimeEnv({
      NODE_ENV: "production",
      OPENROUTER_API_KEY: "or-key",
      DEEPGRAM_API_KEY: "dg-key",
      ELEVENLABS_API_KEY: "el-key",
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_PHONE_NUMBER: "+1234567890",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REDIRECT_URI: "https://dialiq.example.com/oauth/google/callback",
    });

    const readiness = buildProviderReadiness(parsed);

    expect(readiness.find((provider) => provider.key === "twilio")?.configured).toBe(
      true,
    );
    expect(
      readiness.find((provider) => provider.key === "openrouter")?.configured,
    ).toBe(true);
    expect(readiness.find((provider) => provider.key === "crm")?.configured).toBe(
      false,
    );
  });

  it("respects explicit boolean flags while keeping defaults predictable", () => {
    const parsed = parseRuntimeEnv({
      NODE_ENV: "development",
      DIALIQ_MOCK_MODE: "false",
    });

    expect(readBooleanFlag(parsed.DIALIQ_MOCK_MODE, true)).toBe(false);
    expect(readBooleanFlag(undefined, true)).toBe(true);
  });
});
