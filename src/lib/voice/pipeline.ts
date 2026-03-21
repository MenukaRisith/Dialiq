import { z } from "zod";

import { voicePipeline } from "@/lib/mock-data";
import {
  createBookingRecord,
  createLeadRecord,
  loadVoiceWorkspaceContext,
  persistVoiceOutcome,
} from "@/lib/repositories/workspace-operations";
import type {
  BookingType,
  CallOutcome,
  IntentType,
  ProductRecord,
  ServiceRecord,
  TranscriptTurn,
  VoiceCallMatch,
  VoiceCallResult,
  VoiceWebhookPayload,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export const voiceWebhookSchema = z.object({
  tenantId: z.string().min(1),
  channel: z.enum(["phone", "whatsapp-voice"]),
  caller: z.string().min(1),
  transcript: z.string().min(2),
  callId: z.string().optional(),
  bookingType: z.string().optional(),
  selectedSlot: z.string().optional(),
});

const PRODUCT_KEYWORDS = /\b(chair|desk|product|price|under|below|less than|color|colour|white|black|mesh|armrest|catalog)\b/i;
const BOOKING_KEYWORDS = /\b(book|schedule|appointment|consultation|calendar|slot|availability|next week|reserve)\b/i;
const SERVICE_KEYWORDS = /\b(service|consult|hours|visit|installation|showroom|duration|pricing)\b/i;
const CALLBACK_KEYWORDS = /\b(call me|callback|follow up|follow-up|have someone call|reach out)\b/i;
const HANDOFF_KEYWORDS = /\b(custom quote|bulk|enterprise|three locations|delivery terms|shipping dates|manager|human|agent|representative)\b/i;
const LIVE_DATA_KEYWORDS = /\b(in stock|stock|availability today|ship|shipping|delivery|eta|arrive|available now)\b/i;
const CONFIRMATION_KEYWORDS = /\b(works for me|that works|book it|confirm|yes please|sounds good|go ahead)\b/i;
const SLOT_REFERENCE_KEYWORDS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
const TIME_REFERENCE_KEYWORDS = /\b(\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2})\b/i;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(transcript: string, selectedSlot?: string): IntentType {
  if (HANDOFF_KEYWORDS.test(transcript)) {
    return "handoff";
  }

  if (selectedSlot) {
    return "booking";
  }

  if (BOOKING_KEYWORDS.test(transcript)) {
    return "booking";
  }

  if (PRODUCT_KEYWORDS.test(transcript)) {
    return "product-inquiry";
  }

  if (SERVICE_KEYWORDS.test(transcript)) {
    return "service-inquiry";
  }

  if (SLOT_REFERENCE_KEYWORDS.test(transcript) && (TIME_REFERENCE_KEYWORDS.test(transcript) || CONFIRMATION_KEYWORDS.test(transcript))) {
    return "booking";
  }

  if (CALLBACK_KEYWORDS.test(transcript)) {
    return "lead-capture";
  }

  return "general";
}

function extractBudget(transcript: string) {
  const match = transcript.match(/\b(?:under|below|less than)\s+(\d{2,5})\b/i);
  return match ? Number(match[1]) : null;
}

function extractColor(transcript: string) {
  const colors = ["white", "black", "oak", "graphite"];
  return colors.find((color) => new RegExp(`\\b${color}\\b`, "i").test(transcript)) ?? null;
}

function wantsLiveData(transcript: string) {
  return LIVE_DATA_KEYWORDS.test(transcript);
}

function wantsCallback(transcript: string) {
  return CALLBACK_KEYWORDS.test(transcript);
}

function estimateDurationSeconds(transcript: string, responseText: string) {
  const totalWords = `${transcript} ${responseText}`.split(/\s+/).filter(Boolean).length;
  return Math.max(35, totalWords * 2);
}

function createTurn(
  speaker: TranscriptTurn["speaker"],
  text: string,
  timestamp: string,
  tool?: string,
): TranscriptTurn {
  return {
    speaker,
    text,
    timestamp,
    tool,
  };
}

function confidenceFor(intent: IntentType, matches: VoiceCallMatch[], requiresHandoff: boolean) {
  if (requiresHandoff) {
    return intent === "handoff" ? 0.71 : 0.62;
  }

  if (intent === "booking") {
    return matches.length > 0 ? 0.93 : 0.78;
  }

  if (intent === "product-inquiry" || intent === "service-inquiry") {
    return matches.length > 0 ? 0.9 : 0.68;
  }

  if (intent === "lead-capture") {
    return 0.86;
  }

  return 0.66;
}

function filterProducts(products: ProductRecord[], transcript: string) {
  const budget = extractBudget(transcript);
  const color = extractColor(transcript);
  const normalized = normalizeText(transcript);

  return products.filter((product) => {
    const terms = [
      product.category.toLowerCase(),
      product.category.toLowerCase().replace(/s$/, ""),
      ...product.name.toLowerCase().split(" "),
      ...product.features.map((feature) => feature.toLowerCase()),
    ];
    const categoryMatch = terms.some((term) => normalized.includes(term));
    const colorMatch = color ? product.colors.some((item) => item.toLowerCase() === color) : true;
    const budgetMatch = budget ? product.price <= budget : true;

    return categoryMatch && colorMatch && budgetMatch;
  });
}

function summarizeProducts(products: ProductRecord[]) {
  if (products.length === 0) {
    return {
      responseText:
        "I couldn't find a verified product match in the connected data, so the safest next step is a human handoff.",
      matches: [] as VoiceCallMatch[],
    };
  }

  if (products.length === 1) {
    const [product] = products;

    return {
      responseText: `Yes. I found ${product.name} for ${formatCurrency(product.price)}. Verified features include ${product.features.slice(0, 2).join(" and ")}. Would you like more detail or a callback?`,
      matches: [
        {
          type: "product",
          label: product.name,
          detail: `${formatCurrency(product.price)} - ${product.features.join(", ")}`,
        },
      ] satisfies VoiceCallMatch[],
    };
  }

  const matches = products.slice(0, 3).map((product) => ({
    type: "product" as const,
    label: product.name,
    detail: `${formatCurrency(product.price)} - ${product.features.slice(0, 2).join(", ")}`,
  }));

  const summary = products
    .slice(0, 2)
    .map((product) => `${product.name} at ${formatCurrency(product.price)}`)
    .join(", ");

  return {
    responseText: `Yes, I found ${products.length} verified options: ${summary}. Would you like more detail on either one?`,
    matches,
  };
}

function searchServices(services: ServiceRecord[], transcript: string) {
  const normalized = normalizeText(transcript);

  return services.filter((service) => {
    const terms = [
      service.name.toLowerCase(),
      ...service.name.toLowerCase().split(" "),
      ...service.description.toLowerCase().split(" "),
      ...service.bookingWindow.toLowerCase().split(/[\s,-]+/),
    ];

    return terms.some((term) => term.length > 3 && normalized.includes(term));
  });
}

function summarizeServices(services: ServiceRecord[]) {
  if (services.length === 0) {
    return {
      responseText:
        "I can't verify the exact service details from the connected records right now, so the safest next step is a human handoff.",
      matches: [] as VoiceCallMatch[],
    };
  }

  const [service] = services;

  return {
    responseText: `${service.name} is a verified option. It runs for ${service.durationMinutes} minutes and is currently offered ${service.bookingWindow}.`,
    matches: services.slice(0, 2).map((item) => ({
      type: "service" as const,
      label: item.name,
      detail: `${item.durationMinutes} min - ${item.priceRange}`,
    })),
  };
}

function expandWeekday(label: string) {
  return label
    .replace(/\bMon\b/gi, "Monday")
    .replace(/\bTue\b/gi, "Tuesday")
    .replace(/\bWed\b/gi, "Wednesday")
    .replace(/\bThu\b/gi, "Thursday")
    .replace(/\bFri\b/gi, "Friday")
    .replace(/\bSat\b/gi, "Saturday")
    .replace(/\bSun\b/gi, "Sunday");
}

function spokenSlotLabel(slot: string) {
  const expanded = expandWeekday(slot.trim());
  const match = expanded.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2}):(\d{2})$/i);

  if (!match) {
    return expanded;
  }

  const hour = Number(match[2]);
  const minute = match[3];
  const meridiem = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minuteSuffix = minute === "00" ? "" : `:${minute}`;

  return `${match[1]} at ${hour12}${minuteSuffix} ${meridiem}`;
}

function collectSlots(bookingTypes: BookingType[]) {
  return bookingTypes.flatMap((bookingType) =>
    bookingType.availability
      .split(",")
      .map((slot) => slot.trim())
      .filter(Boolean)
      .map((slot) => ({
        bookingType,
        raw: slot,
        spoken: spokenSlotLabel(slot),
      })),
  );
}

function resolveRequestedSlot(bookingTypes: BookingType[], transcript: string, selectedSlot?: string) {
  const normalizedTranscript = normalizeText(selectedSlot ? `${transcript} ${selectedSlot}` : transcript);
  const slots = collectSlots(bookingTypes);

  return slots.find((slot) => {
    const normalizedRaw = normalizeText(slot.raw);
    const normalizedSpoken = normalizeText(slot.spoken);
    const [weekday, time] = normalizedSpoken.split(" at ");

    return (
      normalizedTranscript.includes(normalizedRaw) ||
      normalizedTranscript.includes(normalizedSpoken) ||
      (Boolean(weekday) && Boolean(time) && normalizedTranscript.includes(weekday) && normalizedTranscript.includes(time))
    );
  });
}

function pickBookingType(bookingTypes: BookingType[], transcript: string, explicitBookingType?: string) {
  if (explicitBookingType) {
    const normalizedExplicitType = normalizeText(explicitBookingType);
    const exactMatch = bookingTypes.find((bookingType) =>
      normalizeText(bookingType.name).includes(normalizedExplicitType),
    );

    if (exactMatch) {
      return exactMatch;
    }
  }

  const normalizedTranscript = normalizeText(transcript);

  if (normalizedTranscript.includes("showroom")) {
    return bookingTypes.find((bookingType) =>
      normalizeText(bookingType.name).includes("showroom"),
    ) ?? bookingTypes[0];
  }

  if (normalizedTranscript.includes("installation")) {
    return bookingTypes.find((bookingType) =>
      normalizeText(bookingType.name).includes("installation"),
    ) ?? bookingTypes[0];
  }

  if (normalizedTranscript.includes("discovery")) {
    return bookingTypes.find((bookingType) =>
      normalizeText(bookingType.name).includes("discovery"),
    ) ?? bookingTypes[0];
  }

  return bookingTypes[0];
}

function buildBookingOffer(bookingType: BookingType) {
  const slots = bookingType.availability
    .split(",")
    .map((slot) => slot.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map(spokenSlotLabel);

  if (slots.length === 0) {
    return {
      responseText:
        "I can't verify any booking slots from the connected calendar data right now, so the safest next step is a callback from the team.",
      matches: [] as VoiceCallMatch[],
    };
  }

  const spokenOptions =
    slots.length === 1
      ? slots[0]
      : `${slots.slice(0, -1).join(" or ")} or ${slots.at(-1)}`;

  return {
    responseText: `Sure. I have verified availability for ${bookingType.name.toLowerCase()} on ${spokenOptions}. Which would you prefer?`,
    matches: slots.map((slot) => ({
      type: "slot" as const,
      label: slot,
      detail: `${bookingType.name} - calendar slot`,
    })),
  };
}

function slotToDate(slot: string) {
  const spoken = spokenSlotLabel(slot);
  const match = spoken.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) at (\d{1,2})(?::(\d{2}))? (AM|PM)$/i);

  if (!match) {
    return new Date(Date.now() + 86400000);
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetDay = weekdays.indexOf(match[1].toLowerCase());
  const today = new Date();
  const currentDay = today.getDay();
  const deltaDays = (targetDay - currentDay + 7) % 7 || 7;

  const slotDate = new Date(today);
  slotDate.setDate(today.getDate() + deltaDays);
  let hour = Number(match[2]) % 12;
  if (match[4].toUpperCase() === "PM") {
    hour += 12;
  }

  slotDate.setHours(hour, match[3] ? Number(match[3]) : 0, 0, 0);
  return slotDate;
}

function buildSummary(outcome: CallOutcome, responseText: string, actionSummary: string) {
  if (outcome === "booked") {
    return `Booked a verified slot. ${actionSummary}`;
  }

  if (outcome === "lead-captured") {
    return `Captured a lead safely. ${actionSummary}`;
  }

  if (outcome === "handoff") {
    return `Escalated to a human. ${responseText}`;
  }

  return actionSummary;
}

function interestFromMatches(matches: VoiceCallMatch[], transcript: string) {
  return matches[0]?.label ?? transcript.slice(0, 80);
}

export async function processInboundVoiceCall(
  payload: VoiceWebhookPayload,
): Promise<VoiceCallResult> {
  const startedAt = Date.now();
  const workspace = await loadVoiceWorkspaceContext(payload.tenantId);
  const intent = detectIntent(payload.transcript, payload.selectedSlot);
  const callerTurn = createTurn("caller", payload.transcript, "00:00");

  let outcome: CallOutcome = "resolved";
  let responseText =
    "I can capture your request and route you to the right person, but I don't have enough verified context to answer directly.";
  let trustedSources: string[] = ["Fallback policy"];
  let actionSummary = "Triggered safe fallback.";
  let requiresHandoff = true;
  let matches: VoiceCallMatch[] = [];
  let leadId: string | undefined;
  let bookingId: string | undefined;
  let handoffTarget: string | undefined;
  let toolLabel: string | undefined;

  if (intent === "handoff") {
    requiresHandoff = true;
    outcome = "handoff";
    responseText = `I can't safely verify custom pricing or delivery terms from the connected data, so I'm routing this to ${workspace.profile.handoffTarget ?? "a team member"}.`;
    trustedSources = ["Handoff policy", "Trusted knowledge guardrails"];
    actionSummary = "Detected a custom or unsupported request and triggered human fallback.";
    handoffTarget = workspace.profile.handoffTarget;
  } else if (intent === "booking") {
    const bookingType = pickBookingType(
      workspace.bookingTypes,
      payload.transcript,
      payload.bookingType,
    );
    const requestedSlot = resolveRequestedSlot(
      workspace.bookingTypes,
      payload.transcript,
      payload.selectedSlot,
    );

    trustedSources = ["Google Calendar booking rules", "Structured service booking types"];

    if (bookingType && requestedSlot) {
      const slot = requestedSlot;

      if (slot) {
        const booking = await createBookingRecord({
          workspaceId: workspace.workspaceId,
          customer: payload.caller,
          type: bookingType.name,
          slotAt: slotToDate(slot.raw),
          channel: payload.channel,
          notes: `Created from inbound voice call for ${payload.tenantId}.`,
          status: "confirmed",
        });

        bookingId = booking.id;
        outcome = "booked";
        requiresHandoff = false;
        toolLabel = "Google Calendar create event";
        matches = [
          {
            type: "slot",
            label: slot.spoken,
            detail: `${bookingType.name} - calendar slot`,
          },
        ];
        responseText = `Perfect. Your ${bookingType.name.toLowerCase()} has been booked for ${slot.spoken}. You're all set.`;
        actionSummary = "Confirmed the caller's selected slot and created a booking record.";
      }
    }

    if (bookingId === undefined) {
      const offer = bookingType
        ? buildBookingOffer(bookingType)
        : {
            responseText:
              "I can't verify which service to book from the connected records right now, so the safest next step is a human callback.",
            matches: [] as VoiceCallMatch[],
          };

      responseText = offer.responseText;
      matches = offer.matches;
      requiresHandoff = offer.matches.length === 0;
      outcome = offer.matches.length === 0 ? "handoff" : "resolved";
      actionSummary =
        offer.matches.length === 0
          ? "Unable to verify bookable slots, recommended human follow-up."
          : "Offered verified booking slots and awaited explicit confirmation.";
      handoffTarget = offer.matches.length === 0 ? workspace.profile.handoffTarget : undefined;
      toolLabel = offer.matches.length > 0 ? "Google Calendar availability" : undefined;
    }
  } else if (intent === "product-inquiry") {
    const products = filterProducts(workspace.products, payload.transcript);

    if (wantsLiveData(payload.transcript) && products.some((product) => product.stockStatus !== "connected-live")) {
      requiresHandoff = true;
      outcome = "handoff";
      responseText =
        "I can only speak live stock or delivery timing when that source is connected. I don't have that verified right now, so I'll route this to a team member.";
      trustedSources = ["Structured product catalog", "Inventory guardrail"];
      actionSummary = "Blocked an answer that required unconnected live inventory or delivery data.";
      handoffTarget = workspace.profile.handoffTarget;
    } else {
      const summary = summarizeProducts(products);
      responseText = summary.responseText;
      matches = summary.matches;
      trustedSources = ["Structured product catalog", "FAQ policies"];
      requiresHandoff = products.length === 0;
      outcome = products.length === 0 ? "handoff" : "resolved";
      actionSummary =
        products.length > 0
          ? "Read only verified product data and offered the next safe step."
          : "No safe product match found, recommended human handoff.";

      if (products.length > 0 && wantsCallback(payload.transcript)) {
        const lead = await createLeadRecord({
          workspaceId: workspace.workspaceId,
          customer: payload.caller,
          interest: interestFromMatches(summary.matches, payload.transcript),
          owner: workspace.profile.handoffTarget ?? "Sales queue",
          channel: payload.channel,
          status: "qualified",
          notes: "Callback requested during product inquiry.",
        });

        leadId = lead.id;
        outcome = "lead-captured";
        toolLabel = "CRM lead capture";
        responseText = `I've logged a callback request about ${interestFromMatches(summary.matches, payload.transcript)}. A team member will follow up with you shortly.`;
        actionSummary = "Captured a qualified lead from a grounded product inquiry.";
      }
    }
  } else if (intent === "service-inquiry") {
    const services = searchServices(workspace.services, payload.transcript);
    const summary = summarizeServices(services);

    responseText = summary.responseText;
    matches = summary.matches;
    trustedSources = ["Structured service catalog", "Business hours"];
    requiresHandoff = services.length === 0;
    outcome = services.length === 0 ? "handoff" : "resolved";
    actionSummary =
      services.length > 0
        ? "Answered using connected service records only."
        : "Could not verify a service answer safely and recommended a handoff.";
    handoffTarget = services.length === 0 ? workspace.profile.handoffTarget : undefined;
  } else if (intent === "lead-capture") {
    const lead = await createLeadRecord({
      workspaceId: workspace.workspaceId,
      customer: payload.caller,
      interest: payload.transcript,
      owner: workspace.profile.handoffTarget ?? "Sales queue",
      channel: payload.channel,
      status: "new",
      notes: "General callback request from inbound voice call.",
    });

    leadId = lead.id;
    outcome = "lead-captured";
    requiresHandoff = false;
    responseText = "I've logged your request for a callback, and a team member will follow up shortly.";
    trustedSources = ["CRM capture policy"];
    actionSummary = "Captured a callback request as a lead.";
    toolLabel = "CRM lead capture";
  }

  const agentTurn = createTurn("agent", responseText, "00:04", toolLabel);
  const transcript = [callerTurn, agentTurn];
  const latencyMs = Date.now() - startedAt;
  const confidence = confidenceFor(intent, matches, requiresHandoff);

  const persistedCall = await persistVoiceOutcome({
    workspaceId: workspace.workspaceId,
    externalId: payload.callId,
    caller: payload.caller,
    channel: payload.channel,
    intent,
    outcome,
    confidence,
    durationSeconds: estimateDurationSeconds(payload.transcript, responseText),
    latencyMs,
    summary: buildSummary(outcome, responseText, actionSummary),
    transcript,
    trustedSources,
    actionSummary,
    requiresHandoff,
    matches,
  });

  return {
    callId: persistedCall.id,
    intent,
    outcome,
    confidence,
    latencyMs,
    responseText,
    trustedSources,
    actionSummary,
    requiresHandoff,
    handoffTarget,
    bookingId,
    leadId,
    matches,
    pipeline: voicePipeline,
  };
}

export const simulateInboundVoiceCall = processInboundVoiceCall;
