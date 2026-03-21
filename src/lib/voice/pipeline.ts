import { z } from "zod";

import { appConfig } from "@/lib/config/env";
import { voicePipeline } from "@/lib/mock-data";
import {
  createGoogleCalendarEvent,
  getGoogleCalendarAvailableSlots,
} from "@/lib/providers/google-calendar";
import { composeGroundedVoiceReply } from "@/lib/providers/openrouter";
import {
  retrieveKnowledgeMatches,
  type RetrievedKnowledgeMatch,
} from "@/lib/repositories/knowledge-base";
import {
  createBookingRecord,
  createLeadRecord,
  loadVoiceWorkspaceContext,
  persistVoiceOutcome,
} from "@/lib/repositories/workspace-operations";
import {
  appendSessionTurns,
  clearVoiceSession,
  getVoiceSession,
  type VoiceSessionOfferedSlot,
} from "@/lib/voice/session-state";
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
const CRITICAL_PRODUCT_FIELD_KEYWORDS = /\b(price|pricing|cost|how much|under|below|less than|eur|usd|\$|in stock|stock|shipping|delivery|eta|arrive)\b/i;
const CRITICAL_SERVICE_FIELD_KEYWORDS = /\b(price|pricing|cost|how much|duration|minute|minutes|book|booking|calendar|slot|availability)\b/i;
const CONFIRMATION_KEYWORDS = /\b(works for me|that works|book it|confirm|yes please|sounds good|go ahead)\b/i;
const DETAIL_REQUEST_KEYWORDS = /\b(more detail|more details|tell me more|what about|which one|that one|the other one|the second one|the first one|the cheaper one|the more expensive one|what colors|what colour|what features|what does it include)\b/i;
const SLOT_REFERENCE_KEYWORDS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
const TIME_REFERENCE_KEYWORDS = /\b(\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2})\b/i;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(
  transcript: string,
  selectedSlot?: string,
  context?: {
    lastIntent?: IntentType;
    lastMatches?: VoiceCallMatch[];
    hasOfferedSlots?: boolean;
  },
): IntentType {
  if (HANDOFF_KEYWORDS.test(transcript)) {
    return "handoff";
  }

  if (selectedSlot) {
    return "booking";
  }

  if (BOOKING_KEYWORDS.test(transcript)) {
    return "booking";
  }

  if (
    context?.hasOfferedSlots &&
    (SLOT_REFERENCE_KEYWORDS.test(transcript) ||
      TIME_REFERENCE_KEYWORDS.test(transcript) ||
      CONFIRMATION_KEYWORDS.test(transcript))
  ) {
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

  if (DETAIL_REQUEST_KEYWORDS.test(transcript) && context?.lastIntent) {
    return context.lastIntent;
  }

  if (context?.lastMatches?.length) {
    const normalizedTranscript = normalizeText(transcript);
    const referencesPriorMatch = context.lastMatches.some((match) =>
      normalizedTranscript.includes(normalizeText(match.label)),
    );

    if (referencesPriorMatch) {
      return context.lastIntent ?? "general";
    }
  }

  return "general";
}

function includesAny(text: string, candidates: string[]) {
  return candidates.some((candidate) => text.includes(candidate));
}

function resolveOrdinalIndex(transcript: string, count: number) {
  const normalized = normalizeText(transcript);

  if (/(\b2\b|\btwo\b|\bsecond\b|\blater\b|\bother\b)/.test(normalized) && count >= 2) {
    return 1;
  }

  if (/(\b3\b|\bthree\b|\bthird\b)/.test(normalized) && count >= 3) {
    return 2;
  }

  if (/(\b1\b|\bfirst\b|\bearlier\b|\bcheaper\b)/.test(normalized)) {
    return 0;
  }

  if (/(\bmore expensive\b|\bpremium\b|\bbetter one\b)/.test(normalized) && count >= 2) {
    return count - 1;
  }

  return null;
}

function parsePriceFromDetail(detail: string) {
  const match = detail.match(/(\d{2,5})/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function resolveReferencedMatch(
  transcript: string,
  matches: VoiceCallMatch[],
): VoiceCallMatch | null {
  if (matches.length === 0) {
    return null;
  }

  const normalized = normalizeText(transcript);
  const direct = matches.find((match) =>
    normalized.includes(normalizeText(match.label)),
  );

  if (direct) {
    return direct;
  }

  const ordinalIndex = resolveOrdinalIndex(transcript, matches.length);
  if (ordinalIndex !== null && matches[ordinalIndex]) {
    return matches[ordinalIndex];
  }

  if (normalized.includes("cheaper")) {
    return [...matches].sort(
      (left, right) => parsePriceFromDetail(left.detail) - parsePriceFromDetail(right.detail),
    )[0] ?? null;
  }

  if (normalized.includes("more expensive") || normalized.includes("premium")) {
    return [...matches].sort(
      (left, right) => parsePriceFromDetail(right.detail) - parsePriceFromDetail(left.detail),
    )[0] ?? null;
  }

  if ((normalized.includes("that one") || normalized.includes("the one")) && matches.length === 1) {
    return matches[0];
  }

  return null;
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

function requiresStructuredProductAnswer(transcript: string) {
  return CRITICAL_PRODUCT_FIELD_KEYWORDS.test(transcript);
}

function requiresStructuredServiceAnswer(transcript: string) {
  return CRITICAL_SERVICE_FIELD_KEYWORDS.test(transcript);
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

function candidateTermsForProduct(product: ProductRecord) {
  const categoryTerms = normalizeText(product.category).split(" ");
  const nameTerms = normalizeText(product.name).split(" ");
  const featureTerms = product.features.flatMap((feature) => normalizeText(feature).split(" "));
  const colorTerms = product.colors.map((color) => normalizeText(color));
  const normalizedCategory = normalizeText(product.category);
  const synonyms: string[] = [];

  if (normalizedCategory.includes("desk")) {
    synonyms.push("desk", "desks", "table", "tables", "workstation");
  }

  if (normalizedCategory.includes("seating")) {
    synonyms.push("chair", "chairs", "office chair", "task chair", "seating");
  }

  return Array.from(new Set([...categoryTerms, ...nameTerms, ...featureTerms, ...colorTerms, ...synonyms]));
}

function inferRequestedProductFamily(transcript: string) {
  const normalized = normalizeText(transcript);

  if (includesAny(normalized, ["chair", "chairs", "office chair", "task chair", "seating"])) {
    return "chair";
  }

  if (includesAny(normalized, ["desk", "desks", "table", "tables", "workstation"])) {
    return "desk";
  }

  return null;
}

function filterProducts(products: ProductRecord[], transcript: string) {
  const budget = extractBudget(transcript);
  const color = extractColor(transcript);
  const normalized = normalizeText(transcript);
  const queryTokens = normalized.split(" ").filter(Boolean);
  const requestedFamily = inferRequestedProductFamily(transcript);

  return products
    .map((product) => {
      const productTerms = candidateTermsForProduct(product);
      let score = 0;

      for (const token of queryTokens) {
        if (productTerms.some((term) => term.includes(token) || token.includes(term))) {
          score += token.length > 4 ? 3 : 1;
        }
      }

      if (normalized.includes(normalizeText(product.name))) {
        score += 10;
      }

      if (color && product.colors.some((item) => normalizeText(item) === color)) {
        score += 6;
      }

      if (budget !== null) {
        if (product.price <= budget) {
          score += 5;
        } else {
          score -= 10;
        }
      }

      if (requestedFamily === "chair" && !productTerms.includes("chair")) {
        score -= 12;
      }

      if (requestedFamily === "desk" && !productTerms.includes("desk")) {
        score -= 12;
      }

      return {
        product,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.product.price - right.product.price;
    })
    .map((item) => item.product);
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

function candidateTermsForService(service: ServiceRecord) {
  const normalizedDescription = normalizeText(service.description);
  const terms = new Set([
    ...normalizeText(service.name).split(" "),
    ...normalizedDescription.split(" "),
    ...normalizeText(service.bookingWindow).split(" "),
  ]);

  if (normalizedDescription.includes("consult")) {
    terms.add("consultation");
    terms.add("consult");
  }

  if (normalizeText(service.name).includes("showroom")) {
    terms.add("visit");
    terms.add("onsite");
  }

  if (normalizeText(service.name).includes("discovery")) {
    terms.add("intro");
    terms.add("planning");
  }

  return Array.from(terms);
}

function searchServices(services: ServiceRecord[], transcript: string) {
  const normalized = normalizeText(transcript);
  const tokens = normalized.split(" ").filter(Boolean);

  return services
    .map((service) => {
      const terms = candidateTermsForService(service);
      let score = 0;

      for (const token of tokens) {
        if (token.length > 2 && terms.some((term) => term.includes(token) || token.includes(term))) {
          score += token.length > 4 ? 3 : 1;
        }
      }

      if (normalized.includes(normalizeText(service.name))) {
        score += 8;
      }

      return {
        service,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.service);
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

function findProductByLabel(products: ProductRecord[], label: string) {
  const normalizedLabel = normalizeText(label);
  return products.find((product) => normalizeText(product.name) === normalizedLabel);
}

function findServiceByLabel(services: ServiceRecord[], label: string) {
  const normalizedLabel = normalizeText(label);
  return services.find((service) => normalizeText(service.name) === normalizedLabel);
}

function buildProductDetailReply(product: ProductRecord, transcript: string) {
  const normalized = normalizeText(transcript);
  const colorSummary = product.colors.join(", ");
  const featureSummary = product.features.slice(0, 3).join(", ");

  if (includesAny(normalized, ["color", "colour", "colors", "colours"])) {
    return `${product.name} is available in ${colorSummary}. Verified features include ${featureSummary}.`;
  }

  if (includesAny(normalized, ["feature", "features", "include", "support"])) {
    return `${product.name} is ${formatCurrency(product.price)}. Verified features include ${featureSummary}.`;
  }

  if (includesAny(normalized, ["price", "pricing", "cost", "how much"])) {
    return `${product.name} is ${formatCurrency(product.price)}. It comes in ${colorSummary}.`;
  }

  return `${product.name} is ${formatCurrency(product.price)}, comes in ${colorSummary}, and includes ${featureSummary}.`;
}

function buildServiceDetailReply(service: ServiceRecord, transcript: string) {
  const normalized = normalizeText(transcript);

  if (includesAny(normalized, ["duration", "long", "minutes", "minute"])) {
    return `${service.name} runs for ${service.durationMinutes} minutes. It is currently offered ${service.bookingWindow}.`;
  }

  if (includesAny(normalized, ["price", "pricing", "cost", "how much"])) {
    return `${service.name} is priced ${service.priceRange}. It runs for ${service.durationMinutes} minutes.`;
  }

  if (includesAny(normalized, ["availability", "hours", "when"])) {
    return `${service.name} is currently offered ${service.bookingWindow}. It lasts ${service.durationMinutes} minutes.`;
  }

  return `${service.name} runs for ${service.durationMinutes} minutes, is currently offered ${service.bookingWindow}, and is priced ${service.priceRange}.`;
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

function resolveSlotFromSession(
  transcript: string,
  offeredSlots: VoiceSessionOfferedSlot[],
) {
  if (offeredSlots.length === 0) {
    return null;
  }

  const normalized = normalizeText(transcript);
  const direct = offeredSlots.find(
    (slot) =>
      normalized.includes(normalizeText(slot.spoken)) ||
      normalized.includes(normalizeText(slot.raw)),
  );

  if (direct) {
    return direct;
  }

  const ordinalIndex = resolveOrdinalIndex(transcript, offeredSlots.length);
  if (ordinalIndex !== null && offeredSlots[ordinalIndex]) {
    return offeredSlots[ordinalIndex];
  }

  const weekdayMatch = offeredSlots.find((slot) => {
    const weekday = normalizeText(slot.spoken).split(" at ")[0];
    return Boolean(weekday) && normalized.includes(weekday);
  });

  if (weekdayMatch && CONFIRMATION_KEYWORDS.test(transcript)) {
    return weekdayMatch;
  }

  if (offeredSlots.length === 1 && CONFIRMATION_KEYWORDS.test(transcript)) {
    return offeredSlots[0];
  }

  return null;
}

function buildSlotCandidates(bookingTypes: BookingType[], timeZone: string) {
  return bookingTypes.flatMap((bookingType) =>
    bookingType.availability
      .split(",")
      .map((slot) => slot.trim())
      .filter(Boolean)
      .map((slot) => {
        const start = slotToDate(slot, timeZone);
        return {
          bookingType,
          raw: slot,
          spoken: spokenSlotLabel(slot),
          start,
          end: new Date(start.getTime() + bookingType.durationMinutes * 60000),
        };
      }),
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

function buildBookingOffer(bookingType: BookingType, slots = bookingType.availability
  .split(",")
  .map((slot) => slot.trim())
  .filter(Boolean)
  .slice(0, 3)
  .map(spokenSlotLabel)) {

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

function summarizeKnowledgeAnswer(matches: RetrievedKnowledgeMatch[]) {
  if (matches.length === 0) {
    return null;
  }

  const topMatch = matches[0];
  const supportingMatch = matches[1];
  const responseText = supportingMatch
    ? `From the connected knowledge base, ${topMatch.excerpt} I also found related guidance in ${supportingMatch.sourceLabel}.`
    : `From the connected knowledge base, ${topMatch.excerpt}`;

  return {
    responseText,
    matches: matches.map((match) => ({
      type: "knowledge" as const,
      label: match.documentTitle,
      detail: `${match.sourceLabel} - ${match.excerpt}`,
    })),
    trustedSources: Array.from(new Set(matches.map((match) => match.trustedSource))),
  };
}

async function findKnowledgeFallback(workspaceId: string, transcript: string) {
  const matches = await retrieveKnowledgeMatches({
    workspaceId,
    query: transcript,
    limit: 3,
  });

  return summarizeKnowledgeAnswer(matches);
}

function getOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = zoneName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * (hours * 60 + minutes);
}

function zonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getOffsetMinutes(utcGuess, timeZone);

  return new Date(utcGuess.getTime() - offsetMinutes * 60000);
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? date.getUTCFullYear()),
    month: Number(parts.find((part) => part.type === "month")?.value ?? date.getUTCMonth() + 1),
    day: Number(parts.find((part) => part.type === "day")?.value ?? date.getUTCDate()),
  };
}

function slotToDate(slot: string, timeZone = "UTC") {
  const spoken = spokenSlotLabel(slot);
  const match = spoken.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) at (\d{1,2})(?::(\d{2}))? (AM|PM)$/i);

  if (!match) {
    return new Date(Date.now() + 86400000);
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetDay = weekdays.indexOf(match[1].toLowerCase());
  const today = new Date();
  const currentWeekdayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  })
    .format(today)
    .toLowerCase();
  const currentDay = weekdays.indexOf(currentWeekdayLabel);
  const deltaDays = (targetDay - currentDay + 7) % 7 || 7;

  const targetDate = new Date(today.getTime() + deltaDays * 86400000);
  let hour = Number(match[2]) % 12;
  if (match[4].toUpperCase() === "PM") {
    hour += 12;
  }

  const { year, month, day } = getDatePartsInTimeZone(targetDate, timeZone);

  return zonedDate(year, month, day, hour, match[3] ? Number(match[3]) : 0, timeZone);
}

async function maybeComposeLiveReply(input: {
  callerTranscript: string;
  intent: IntentType;
  fallbackResponse: string;
  trustedSources: string[];
  actionSummary: string;
  requiresHandoff: boolean;
  matches: VoiceCallMatch[];
  recentTurns: TranscriptTurn[];
}) {
  if (appConfig.isMockMode) {
    return input.fallbackResponse;
  }

  return composeGroundedVoiceReply({
    callerTranscript: input.callerTranscript,
    intent: input.intent,
    fallbackResponse: input.fallbackResponse,
    trustedSources: input.trustedSources,
    actionSummary: input.actionSummary,
    requiresHandoff: input.requiresHandoff,
    matches: input.matches,
    recentTurns: input.recentTurns,
  });
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

function sanitizeVoiceResponse(value: string) {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();

  if (!normalized) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()) ?? [normalized];
  const limitedSentences = sentences.filter(Boolean).slice(0, 2);
  let reply = limitedSentences.join(" ").trim();

  const questionMarks = (reply.match(/\?/g) ?? []).length;
  if (questionMarks > 1) {
    const firstQuestionIndex = reply.indexOf("?");
    reply = reply.slice(0, firstQuestionIndex + 1);
  }

  if (reply.length > 260) {
    const clipped = reply.slice(0, 257);
    const boundary = clipped.lastIndexOf(" ");
    reply = `${clipped.slice(0, boundary > 180 ? boundary : 257).trim()}...`;
  }

  return reply;
}

function interestFromMatches(matches: VoiceCallMatch[], transcript: string) {
  return matches[0]?.label ?? transcript.slice(0, 80);
}

export async function processInboundVoiceCall(
  payload: VoiceWebhookPayload,
): Promise<VoiceCallResult> {
  const startedAt = Date.now();
  const workspace = await loadVoiceWorkspaceContext(payload.tenantId);
  const session = getVoiceSession(payload);
  const sessionResolvedSlot = resolveSlotFromSession(payload.transcript, session.offeredSlots);
  const effectiveSelectedSlot = payload.selectedSlot ?? sessionResolvedSlot?.spoken;
  const effectiveBookingType = payload.bookingType ?? session.lastBookingTypeName;
  const intent = detectIntent(payload.transcript, effectiveSelectedSlot, {
    lastIntent: session.lastIntent,
    lastMatches: session.lastMatches,
    hasOfferedSlots: session.offeredSlots.length > 0,
  });
  const callerTurn = createTurn("caller", payload.transcript, "00:00");
  const referencedPriorMatch = resolveReferencedMatch(payload.transcript, session.lastMatches);

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
  let nextOfferedSlots: VoiceSessionOfferedSlot[] = session.offeredSlots;
  let nextBookingTypeId = session.lastBookingTypeId;
  let nextBookingTypeName = session.lastBookingTypeName;

  if (intent === "handoff") {
    requiresHandoff = true;
    outcome = "handoff";
    responseText = `I can't safely verify custom pricing or delivery terms from the connected data, so I'm routing this to ${workspace.profile.handoffTarget ?? "a team member"}.`;
    trustedSources = ["Handoff policy", "Trusted knowledge guardrails"];
    actionSummary = "Detected a custom or unsupported request and triggered human fallback.";
    handoffTarget = workspace.profile.handoffTarget;
    nextOfferedSlots = [];
  } else if (intent === "booking") {
    const bookingType = pickBookingType(
      workspace.bookingTypes,
      payload.transcript,
      effectiveBookingType,
    );
    const slotCandidates = buildSlotCandidates(
      workspace.bookingTypes,
      workspace.profile.timezone,
    );
    const requestedSlot = resolveRequestedSlot(
      workspace.bookingTypes,
      payload.transcript,
      effectiveSelectedSlot,
    );
    nextBookingTypeId = bookingType?.id;
    nextBookingTypeName = bookingType?.name;

    trustedSources = ["Google Calendar booking rules", "Structured service booking types"];

    if (bookingType && requestedSlot) {
      const slot =
        slotCandidates.find(
          (candidate) =>
            candidate.raw === requestedSlot.raw &&
            candidate.bookingType.id === requestedSlot.bookingType.id,
        ) ?? {
          ...requestedSlot,
          start: slotToDate(requestedSlot.raw, workspace.profile.timezone),
          end: new Date(
            slotToDate(requestedSlot.raw, workspace.profile.timezone).getTime() +
              requestedSlot.bookingType.durationMinutes * 60000,
          ),
        };

      if (slot) {
        const slotAt = slot.start;

        if (appConfig.isMockMode) {
          const booking = await createBookingRecord({
            workspaceId: workspace.workspaceId,
            customer: payload.caller,
            type: bookingType.name,
            slotAt,
            channel: payload.channel,
            notes: `Mock booking created from inbound voice call for ${payload.tenantId}.`,
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
          nextOfferedSlots = [];
        } else {
          try {
            const availableSelection = await getGoogleCalendarAvailableSlots({
              workspaceId: workspace.workspaceId,
              timezone: workspace.profile.timezone,
              candidates: [
                {
                  label: slot.spoken,
                  start: slot.start,
                  end: slot.end,
                },
              ],
            });

            if (availableSelection.length === 0) {
              throw new Error("Requested slot is no longer available.");
            }

            const event = await createGoogleCalendarEvent({
              workspaceId: workspace.workspaceId,
              summary: `${bookingType.name} with ${payload.caller}`,
              description: `Inbound voice booking created by Dialiq for workspace ${payload.tenantId}.`,
              start: slotAt,
              end: new Date(slotAt.getTime() + bookingType.durationMinutes * 60000),
              timezone: workspace.profile.timezone,
            });

            const booking = await createBookingRecord({
              workspaceId: workspace.workspaceId,
              customer: payload.caller,
              type: bookingType.name,
              slotAt,
              externalEventId: event.id ?? undefined,
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
            actionSummary = "Confirmed the caller's selected slot and created a Google Calendar event.";
            nextOfferedSlots = [];
          } catch {
            responseText =
              "I couldn't confirm that slot against the connected calendar right now, so the safest next step is a callback from the team.";
            actionSummary =
              "Calendar confirmation failed, so no booking was created and the call was routed to safe fallback.";
            requiresHandoff = true;
            outcome = "handoff";
            handoffTarget = workspace.profile.handoffTarget;
            matches = [];
            nextOfferedSlots = [];
          }
        }
      }
    }

    if (bookingId === undefined) {
      const fallbackOffer = {
        responseText:
          "I can't verify which service to book from the connected records right now, so the safest next step is a human callback.",
        matches: [] as VoiceCallMatch[],
      };

      if (appConfig.isMockMode) {
        const bookingOffer = bookingType ? buildBookingOffer(bookingType) : fallbackOffer;

        responseText = bookingOffer.responseText;
        matches = bookingOffer.matches;
        requiresHandoff = bookingOffer.matches.length === 0;
        outcome = bookingOffer.matches.length === 0 ? "handoff" : "resolved";
        actionSummary =
          bookingOffer.matches.length === 0
            ? "Unable to verify bookable slots, recommended human follow-up."
            : "Offered verified booking slots and awaited explicit confirmation.";
        handoffTarget =
          bookingOffer.matches.length === 0 ? workspace.profile.handoffTarget : undefined;
        toolLabel =
          bookingOffer.matches.length > 0 ? "Google Calendar availability" : undefined;
        nextOfferedSlots = slotCandidates
          .filter((candidate) => bookingOffer.matches.some((match) => match.label === candidate.spoken))
          .map((candidate) => ({
            bookingTypeId: candidate.bookingType.id,
            bookingTypeName: candidate.bookingType.name,
            raw: candidate.raw,
            spoken: candidate.spoken,
            startIso: candidate.start.toISOString(),
            endIso: candidate.end.toISOString(),
          }));
      } else if (bookingType) {
        try {
          const candidates = buildSlotCandidates([bookingType], workspace.profile.timezone).slice(0, 6);
          const availableSlots = await getGoogleCalendarAvailableSlots({
            workspaceId: workspace.workspaceId,
            timezone: workspace.profile.timezone,
            candidates: candidates.map((candidate) => ({
              label: candidate.spoken,
              start: candidate.start,
              end: candidate.end,
            })),
          });
          const spokenSlots = availableSlots.slice(0, 3).map((candidate) => candidate.label);
          const bookingOffer = buildBookingOffer(bookingType, spokenSlots);

          responseText = bookingOffer.responseText;
          matches = bookingOffer.matches;
          requiresHandoff = bookingOffer.matches.length === 0;
          outcome = bookingOffer.matches.length === 0 ? "handoff" : "resolved";
          actionSummary =
            bookingOffer.matches.length === 0
              ? "Google Calendar returned no open slots for the configured booking windows."
              : "Read live Google Calendar availability and offered open slots only.";
          handoffTarget =
            bookingOffer.matches.length === 0 ? workspace.profile.handoffTarget : undefined;
          toolLabel =
            bookingOffer.matches.length > 0 ? "Google Calendar availability" : undefined;
          nextOfferedSlots = candidates
            .filter((candidate) => bookingOffer.matches.some((match) => match.label === candidate.spoken))
            .map((candidate) => ({
              bookingTypeId: candidate.bookingType.id,
              bookingTypeName: candidate.bookingType.name,
              raw: candidate.raw,
              spoken: candidate.spoken,
              startIso: candidate.start.toISOString(),
              endIso: candidate.end.toISOString(),
            }));
        } catch {
          responseText =
            "I couldn't verify live availability from the connected calendar right now, so the safest next step is a callback from the team.";
          matches = [];
          requiresHandoff = true;
          outcome = "handoff";
          actionSummary =
            "Live Google Calendar availability could not be verified, so the flow was routed to safe fallback.";
          handoffTarget = workspace.profile.handoffTarget;
          nextOfferedSlots = [];
        }
      } else {
        responseText = fallbackOffer.responseText;
        matches = fallbackOffer.matches;
        requiresHandoff = true;
        outcome = "handoff";
        actionSummary =
          "Unable to map the caller request to a known booking type, recommended human follow-up.";
        handoffTarget = workspace.profile.handoffTarget;
        nextOfferedSlots = [];
      }
    }
  } else if (intent === "product-inquiry") {
    const referencedProduct =
      referencedPriorMatch?.type === "product"
        ? findProductByLabel(workspace.products, referencedPriorMatch.label)
        : null;
    const products = referencedProduct
      ? [referencedProduct]
      : filterProducts(workspace.products, payload.transcript);

    if (wantsLiveData(payload.transcript) && products.some((product) => product.stockStatus !== "connected-live")) {
      requiresHandoff = true;
      outcome = "handoff";
      responseText =
        "I can only speak live stock or delivery timing when that source is connected. I don't have that verified right now, so I'll route this to a team member.";
      trustedSources = ["Structured product catalog", "Inventory guardrail"];
      actionSummary = "Blocked an answer that required unconnected live inventory or delivery data.";
      handoffTarget = workspace.profile.handoffTarget;
      nextOfferedSlots = [];
    } else {
      const wantsProductDetail =
        Boolean(referencedProduct) &&
        (DETAIL_REQUEST_KEYWORDS.test(payload.transcript) ||
          !PRODUCT_KEYWORDS.test(payload.transcript));
      const summary = wantsProductDetail && referencedProduct
        ? {
            responseText: buildProductDetailReply(referencedProduct, payload.transcript),
            matches: [
              {
                type: "product" as const,
                label: referencedProduct.name,
                detail: `${formatCurrency(referencedProduct.price)} - ${referencedProduct.features.join(", ")}`,
              },
            ],
          }
        : summarizeProducts(products);
      responseText = summary.responseText;
      matches = summary.matches;
      trustedSources = ["Structured product catalog", "FAQ policies"];
      requiresHandoff = products.length === 0;
      outcome = products.length === 0 ? "handoff" : "resolved";
      actionSummary =
        products.length > 0
          ? referencedProduct && wantsProductDetail
            ? "Answered a follow-up about a previously matched verified product."
            : "Read only verified product data and offered the next safe step."
          : "No safe product match found, recommended human handoff.";

      if (products.length === 0) {
        if (!requiresStructuredProductAnswer(payload.transcript)) {
          const knowledgeFallback = await findKnowledgeFallback(
            workspace.workspaceId,
            payload.transcript,
          );

          if (knowledgeFallback) {
            responseText = `${knowledgeFallback.responseText} Would you like more detail or a callback?`;
            matches = knowledgeFallback.matches;
            trustedSources = knowledgeFallback.trustedSources;
            requiresHandoff = false;
            outcome = "resolved";
            actionSummary =
              "No structured product match existed, so Dialiq answered from retrieved website or document knowledge.";
          }
        }
      }

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

      nextOfferedSlots = [];
    }
  } else if (intent === "service-inquiry") {
    const referencedService =
      referencedPriorMatch?.type === "service"
        ? findServiceByLabel(workspace.services, referencedPriorMatch.label)
        : null;
    const services = referencedService
      ? [referencedService]
      : searchServices(workspace.services, payload.transcript);
    const wantsServiceDetail =
      Boolean(referencedService) &&
      (DETAIL_REQUEST_KEYWORDS.test(payload.transcript) ||
        !SERVICE_KEYWORDS.test(payload.transcript));
    const summary = wantsServiceDetail && referencedService
      ? {
          responseText: buildServiceDetailReply(referencedService, payload.transcript),
          matches: [
            {
              type: "service" as const,
              label: referencedService.name,
              detail: `${referencedService.durationMinutes} min - ${referencedService.priceRange}`,
            },
          ],
        }
      : summarizeServices(services);

    responseText = summary.responseText;
    matches = summary.matches;
    trustedSources = ["Structured service catalog", "Business hours"];
    requiresHandoff = services.length === 0;
    outcome = services.length === 0 ? "handoff" : "resolved";
    actionSummary =
      services.length > 0
        ? referencedService && wantsServiceDetail
          ? "Answered a follow-up about a previously matched verified service."
          : "Answered using connected service records only."
        : "Could not verify a service answer safely and recommended a handoff.";
    handoffTarget = services.length === 0 ? workspace.profile.handoffTarget : undefined;
    if (services.length === 0) {
      if (!requiresStructuredServiceAnswer(payload.transcript)) {
        const knowledgeFallback = await findKnowledgeFallback(
          workspace.workspaceId,
          payload.transcript,
        );

        if (knowledgeFallback) {
          responseText = knowledgeFallback.responseText;
          matches = knowledgeFallback.matches;
          trustedSources = knowledgeFallback.trustedSources;
          requiresHandoff = false;
          outcome = "resolved";
          actionSummary =
            "No structured service record matched, so Dialiq answered from retrieved website or document knowledge.";
          handoffTarget = undefined;
        }
      }
    }
    nextOfferedSlots = [];
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
    nextOfferedSlots = [];
  } else {
    const knowledgeFallback = await findKnowledgeFallback(
      workspace.workspaceId,
      payload.transcript,
    );

    if (knowledgeFallback) {
      responseText = knowledgeFallback.responseText;
      matches = knowledgeFallback.matches;
      trustedSources = knowledgeFallback.trustedSources;
      actionSummary = "Answered from retrieved website or document knowledge.";
      requiresHandoff = false;
      outcome = "resolved";
    }
    nextOfferedSlots = [];
  }

  const agentTurnSeed = createTurn("agent", responseText, "00:04", toolLabel);
  const recentTurns = [...session.recentTurns, callerTurn, agentTurnSeed].slice(-8);

  responseText = await maybeComposeLiveReply({
    callerTranscript: payload.transcript,
    intent,
    fallbackResponse: responseText,
    trustedSources,
    actionSummary,
    requiresHandoff,
    matches,
    recentTurns,
  });
  responseText = sanitizeVoiceResponse(responseText);

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

  appendSessionTurns(payload, transcript);

  if (outcome === "handoff") {
    clearVoiceSession(payload);
  } else {
    const updatedSession = getVoiceSession(payload);
    updatedSession.lastIntent = intent;
    updatedSession.lastMatches = matches;
    updatedSession.lastResponseText = responseText;
    updatedSession.lastBookingTypeId = nextBookingTypeId;
    updatedSession.lastBookingTypeName = nextBookingTypeName;
    updatedSession.offeredSlots = nextOfferedSlots;
    updatedSession.updatedAt = Date.now();
  }

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
