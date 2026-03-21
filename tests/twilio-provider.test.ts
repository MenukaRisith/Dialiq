import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("twilio provider helpers", () => {
  it("builds realtime TwiML with the websocket gateway and custom parameters", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dialiq.example.com");
    vi.stubEnv("DIALIQ_MOCK_MODE", "false");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "token");

    const {
      buildTwilioStreamResponse,
      getTwilioRealtimeWebSocketUrl,
    } = await import("@/lib/providers/twilio");

    const wsUrl = getTwilioRealtimeWebSocketUrl();
    const twiml = buildTwilioStreamResponse({
      tenantId: "atelier-workspace",
      caller: "+15551234567",
      callSid: "CA123",
      channel: "phone",
    });

    expect(wsUrl).toBe("wss://dialiq.example.com/realtime/twilio");
    expect(twiml).toContain("wss://dialiq.example.com/realtime/twilio");
    expect(twiml).toContain("tenantId");
    expect(twiml).toContain("atelier-workspace");
    expect(twiml).toContain("callSid");
    expect(twiml).toContain("CA123");
  });
});
