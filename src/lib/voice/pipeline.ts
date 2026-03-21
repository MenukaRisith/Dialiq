import { z } from "zod";

import { productCatalog, serviceCatalog, voicePipeline } from "@/lib/mock-data";
import type {
  IntentType,
  ProductRecord,
  ServiceRecord,
  VoiceSimulationMatch,
  VoiceSimulationResponse,
  VoiceWebhookPayload,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export const voiceWebhookSchema = z.object({
  tenantId: z.string().min(1),
  channel: z.enum(["phone", "whatsapp-voice"]),
  caller: z.string().min(1),
  transcript: z.string().min(6),
});

function detectIntent(transcript: string): IntentType {
  if (/\b(book|schedule|appointment|consultation|calendar|slot)\b/i.test(transcript)) {
    return "booking";
  }

  if (
    /\b(chair|desk|product|price|under|color|white|black|available)\b/i.test(
      transcript,
    )
  ) {
    return "product-inquiry";
  }

  if (/\b(service|consult|hours|visit|installation)\b/i.test(transcript)) {
    return "service-inquiry";
  }

  if (/\b(call me|follow up|quote|sales)\b/i.test(transcript)) {
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

function filterProducts(transcript: string) {
  const budget = extractBudget(transcript);
  const color = extractColor(transcript);
  const normalized = transcript.toLowerCase();

  return productCatalog.filter((product) => {
    const categoryTerms = [
      product.category.toLowerCase(),
      product.category.toLowerCase().replace(/s$/, ""),
      ...product.name.toLowerCase().split(" "),
    ];
    const categoryMatch =
      categoryTerms.some((term) => normalized.includes(term)) ||
      product.features.some((feature) => normalized.includes(feature.toLowerCase()));
    const colorMatch = color ? product.colors.includes(color) : true;
    const budgetMatch = budget ? product.price <= budget : true;

    return (categoryMatch || normalized.includes("product")) && colorMatch && budgetMatch;
  });
}

function summarizeProducts(products: ProductRecord[]): {
  responseText: string;
  matches: VoiceSimulationMatch[];
} {
  if (products.length === 0) {
    return {
      responseText:
        "I couldn't find a verified match in the connected product data, so I'd rather hand you to a team member than guess.",
      matches: [],
    };
  }

  if (products.length === 1) {
    const product = products[0];
    return {
      responseText: `Yes. I found ${product.name} for ${formatCurrency(product.price)}. Its verified features include ${product.features.slice(0, 2).join(" and ")}. Would you like more details or a callback?`,
      matches: [
        {
          type: "product",
          label: product.name,
          detail: `${formatCurrency(product.price)} - ${product.features.join(", ")}`,
        },
      ],
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

function summarizeServices(services: ServiceRecord[]): {
  responseText: string;
  matches: VoiceSimulationMatch[];
} {
  if (services.length === 0) {
    return {
      responseText:
        "I can't verify the exact service details from the connected data right now, so the safest next step is a human handoff.",
      matches: [],
    };
  }

  return {
    responseText: `The best verified fit is ${services[0].name}. It runs for ${services[0].durationMinutes} minutes and is currently offered ${services[0].bookingWindow}.`,
    matches: services.slice(0, 2).map((service) => ({
      type: "service",
      label: service.name,
      detail: `${service.durationMinutes} min - ${service.priceRange}`,
    })),
  };
}

function summarizeBooking(): {
  responseText: string;
  matches: VoiceSimulationMatch[];
} {
  return {
    responseText:
      "Sure. I have verified availability on Tuesday at 2 PM or Thursday at 11 AM. Which would you prefer?",
    matches: [
      {
        type: "slot",
        label: "Tuesday 14:00",
        detail: "Discovery call - Google Calendar verified",
      },
      {
        type: "slot",
        label: "Thursday 11:00",
        detail: "Discovery call - Google Calendar verified",
      },
    ],
  };
}

function searchServices(transcript: string) {
  const normalized = transcript.toLowerCase();
  return serviceCatalog.filter(
    (service) =>
      normalized.includes("consult") ||
      normalized.includes("service") ||
      normalized.includes("hours") ||
      normalized.includes(service.name.toLowerCase().split(" ")[0]),
  );
}

export async function simulateInboundVoiceCall(
  payload: VoiceWebhookPayload,
): Promise<VoiceSimulationResponse> {
  const intent = detectIntent(payload.transcript);

  if (intent === "booking") {
    const booking = summarizeBooking();
    return {
      intent,
      responseText: booking.responseText,
      trustedSources: ["Google Calendar", "Service booking rules"],
      actionSummary: "Offered verified booking slots and awaited explicit confirmation.",
      requiresHandoff: false,
      matches: booking.matches,
      pipeline: voicePipeline,
    };
  }

  if (intent === "product-inquiry") {
    const products = filterProducts(payload.transcript);
    const productSummary = summarizeProducts(products);

    return {
      intent,
      responseText: productSummary.responseText,
      trustedSources: ["Structured product catalog", "FAQ policies"],
      actionSummary:
        products.length > 0
          ? "Read only verified catalog data and offered a follow-up path."
          : "No safe product match found, recommend human handoff.",
      requiresHandoff: products.length === 0,
      matches: productSummary.matches,
      pipeline: voicePipeline,
    };
  }

  if (intent === "service-inquiry") {
    const services = searchServices(payload.transcript);
    const serviceSummary = summarizeServices(services);

    return {
      intent,
      responseText: serviceSummary.responseText,
      trustedSources: ["Structured service catalog", "Business hours"],
      actionSummary: "Answered using connected service records only.",
      requiresHandoff: services.length === 0,
      matches: serviceSummary.matches,
      pipeline: voicePipeline,
    };
  }

  return {
    intent,
    responseText:
      "I can capture your request and route you to the right person, but I don't have enough verified context to answer directly.",
    trustedSources: ["Fallback policy"],
    actionSummary: "Triggered safe fallback.",
    requiresHandoff: true,
    matches: [],
    pipeline: voicePipeline,
  };
}
