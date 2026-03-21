import { describe, expect, it } from "vitest";

import { simulateInboundVoiceCall } from "@/lib/voice/pipeline";

describe("simulateInboundVoiceCall", () => {
  it("grounds product searches against structured catalog matches", async () => {
    const result = await simulateInboundVoiceCall({
      tenantId: "atelier-workspace",
      channel: "phone",
      caller: "Elena Novak",
      transcript: "Do you have black office chairs under 300 euros?",
    });

    expect(result.intent).toBe("product-inquiry");
    expect(result.requiresHandoff).toBe(false);
    expect(result.matches).toHaveLength(2);
    expect(result.matches.map((match) => match.label)).toEqual([
      "Luma Black Office Chair",
      "Pivot Black Office Chair",
    ]);
  });

  it("returns verified booking slots for booking intent", async () => {
    const result = await simulateInboundVoiceCall({
      tenantId: "atelier-workspace",
      channel: "whatsapp-voice",
      caller: "Jonas Meyer",
      transcript: "I want to book a consultation for next week.",
    });

    expect(result.intent).toBe("booking");
    expect(result.requiresHandoff).toBe(false);
    expect(result.matches.map((match) => match.label)).toEqual([
      "Tuesday 14:00",
      "Thursday 11:00",
    ]);
  });

  it("falls back safely when no verified match exists", async () => {
    const result = await simulateInboundVoiceCall({
      tenantId: "atelier-workspace",
      channel: "phone",
      caller: "Procurement Desk",
      transcript: "Can you promise custom shipping dates for 50 desks?",
    });

    expect(result.requiresHandoff).toBe(true);
    expect(result.matches).toHaveLength(0);
  });
});
