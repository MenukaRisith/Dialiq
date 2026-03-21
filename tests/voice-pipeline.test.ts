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
    expect(result.outcome).toBe("resolved");
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
    expect(result.outcome).toBe("resolved");
    expect(result.requiresHandoff).toBe(false);
    expect(result.matches.map((match) => match.label)).toEqual([
      "Tuesday at 2 PM",
      "Thursday at 11 AM",
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
    expect(result.outcome).toBe("handoff");
    expect(result.matches).toHaveLength(0);
  });

  it("creates a confirmed booking only when the caller states the exact slot", async () => {
    const result = await simulateInboundVoiceCall({
      tenantId: "atelier-workspace",
      channel: "phone",
      caller: "Nadia Cole",
      transcript: "Tuesday at 2 PM works for me.",
      selectedSlot: "Tuesday at 2 PM",
      bookingType: "Discovery call",
    });

    expect(result.intent).toBe("booking");
    expect(result.outcome).toBe("booked");
    expect(result.requiresHandoff).toBe(false);
    expect(result.bookingId).toBeTruthy();
    expect(result.responseText).toContain("booked");
  });

  it("blocks live availability promises when inventory is not connected", async () => {
    const result = await simulateInboundVoiceCall({
      tenantId: "atelier-workspace",
      channel: "phone",
      caller: "Marco Weiss",
      transcript: "Is the Faro White Desk in stock today and can you ship it tomorrow?",
    });

    expect(result.intent).toBe("product-inquiry");
    expect(result.outcome).toBe("handoff");
    expect(result.requiresHandoff).toBe(true);
    expect(result.responseText).toContain("live stock");
  });

  it("captures a callback lead from a grounded product conversation", async () => {
    const result = await simulateInboundVoiceCall({
      tenantId: "atelier-workspace",
      channel: "phone",
      caller: "Elena Novak",
      transcript: "Do you have any white desks under 200 euros? Please call me back about the Faro desk.",
    });

    expect(result.intent).toBe("product-inquiry");
    expect(result.outcome).toBe("lead-captured");
    expect(result.requiresHandoff).toBe(false);
    expect(result.leadId).toBeTruthy();
  });
});
