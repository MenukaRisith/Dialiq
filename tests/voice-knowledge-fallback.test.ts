import { beforeEach, describe, expect, it, vi } from "vitest";

const retrieveKnowledgeMatches = vi.fn();

vi.mock("@/lib/repositories/knowledge-base", () => ({
  retrieveKnowledgeMatches,
}));

vi.mock("@/lib/repositories/workspace-operations", () => ({
  loadVoiceWorkspaceContext: vi.fn(async () => ({
    workspaceId: "workspace-1",
    profile: {
      name: "Dialiq Demo",
      workspaceName: "Dialiq Demo",
      mode: "hybrid",
      timezone: "Europe/Berlin",
      stack: [],
      summary: "Demo workspace",
      handoffTarget: "Sales queue",
      voiceGreeting: "Hello",
    },
    knowledgeSources: [],
    products: [],
    services: [],
    bookingTypes: [],
    calls: [],
    bookings: [],
    leads: [],
  })),
  createBookingRecord: vi.fn(),
  createLeadRecord: vi.fn(),
  persistVoiceOutcome: vi.fn(async (input: { durationSeconds: number }) => ({
    id: "call-test",
    durationSeconds: input.durationSeconds,
  })),
}));

vi.mock("@/lib/providers/openrouter", () => ({
  composeGroundedVoiceReply: vi.fn(async (input: { fallbackResponse: string }) => input.fallbackResponse),
}));

describe("voice knowledge fallback", () => {
  beforeEach(() => {
    retrieveKnowledgeMatches.mockReset();
  });

  it("answers general questions from retrieved knowledge chunks", async () => {
    retrieveKnowledgeMatches.mockResolvedValue([
      {
        documentTitle: "Showroom Guide",
        excerpt: "the showroom is open Monday to Friday from 9 AM to 6 PM.",
        sourceLabel: "showroom-guide.md",
        trustedSource: "showroom-guide.md",
        score: 14,
      },
    ]);

    const { processInboundVoiceCall } = await import("@/lib/voice/pipeline");
    const result = await processInboundVoiceCall({
      tenantId: "atelier-workspace",
      channel: "phone",
      caller: "Nadia Cole",
      transcript: "What are your showroom opening hours?",
    });

    expect(result.outcome).toBe("resolved");
    expect(result.requiresHandoff).toBe(false);
    expect(result.matches[0]?.type).toBe("knowledge");
    expect(result.responseText).toContain("connected knowledge base");
  });

  it("does not let document retrieval replace critical structured product answers", async () => {
    retrieveKnowledgeMatches.mockResolvedValue([
      {
        documentTitle: "Old Catalog",
        excerpt: "the black office chair was listed at 299 EUR in a previous brochure.",
        sourceLabel: "catalog.pdf",
        trustedSource: "catalog.pdf",
        score: 16,
      },
    ]);

    const { processInboundVoiceCall } = await import("@/lib/voice/pipeline");
    const result = await processInboundVoiceCall({
      tenantId: "atelier-workspace",
      channel: "phone",
      caller: "Marco Weiss",
      transcript: "How much is your black office chair?",
    });

    expect(result.outcome).toBe("handoff");
    expect(result.requiresHandoff).toBe(true);
    expect(result.matches).toHaveLength(0);
  });
});
