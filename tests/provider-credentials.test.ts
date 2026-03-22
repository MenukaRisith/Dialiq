import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("provider credential repository", () => {
  it("falls back to environment-backed readiness when MySQL is not configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("DEEPGRAM_API_KEY", "dg-key");
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "token");
    vi.stubEnv("TWILIO_PHONE_NUMBER", "+15551234567");

    const repository = await import("@/lib/repositories/provider-credentials");
    const dashboard = await repository.listProviderCredentialsDashboard();
    const readiness = await repository.getResolvedProviderReadiness();

    expect(dashboard.database.configured).toBe(false);
    expect(
      dashboard.credentials.find(
        (credential) => credential.configKey === "TWILIO_AUTH_TOKEN",
      )?.source,
    ).toBe("environment");
    expect(
      dashboard.credentials.find(
        (credential) => credential.configKey === "TWILIO_AUTH_TOKEN",
      )?.status,
    ).toBe("healthy");
    expect(
      dashboard.credentials.find(
        (credential) => credential.configKey === "ELEVENLABS_API_KEY",
      )?.status,
    ).toBe("warning");
    expect(readiness.find((provider) => provider.key === "openrouter")?.source).toBe(
      "environment",
    );
    expect(readiness.find((provider) => provider.key === "elevenlabs")?.configured).toBe(
      false,
    );
  });
});
