import {
  BookingStatus as PrismaBookingStatus,
  BusinessMode as PrismaBusinessMode,
  CallChannel as PrismaCallChannel,
  CallOutcome as PrismaCallOutcome,
  LeadStatus as PrismaLeadStatus,
  Prisma,
} from "@prisma/client";

import { AppError } from "@/lib/api/route-handler";
import { appConfig, env } from "@/lib/config/env";
import {
  getPrismaClient,
  isDatabaseConfigured,
  withDatabaseTimeout,
} from "@/lib/db/prisma";
import {
  analyticsBreakdown as mockAnalyticsBreakdown,
  bookingTypes as mockBookingTypes,
  bookings as mockBookings,
  dashboardMetrics as mockDashboardMetrics,
  integrations as mockIntegrations,
  knowledgeSources as mockKnowledgeSources,
  leadCaptures as mockLeadCaptures,
  onboardingChecklist,
  productCatalog as mockProductCatalog,
  recentCalls as mockRecentCalls,
  serviceCatalog as mockServiceCatalog,
  teamMembers,
  voicePipeline,
  weeklyVolume as mockWeeklyVolume,
  workspaceProfile as mockWorkspaceProfile,
} from "@/lib/mock-data";
import { logError } from "@/lib/observability/logger";
import type {
  AgentRule,
  AnalyticsBar,
  BookingRecord,
  BookingType,
  CallChannel,
  CallOutcome,
  DashboardMetric,
  IntentType,
  KnowledgeSource,
  LeadRecord,
  ProductRecord,
  RecentCall,
  ServiceRecord,
  TranscriptTurn,
  WeeklyVolumePoint,
  WorkspaceProfile,
} from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils";

export const DEFAULT_TENANT_ID = "atelier-workspace";

interface WorkspaceOperationalData {
  workspaceId: string;
  profile: WorkspaceProfile;
  knowledgeSources: KnowledgeSource[];
  products: ProductRecord[];
  services: ServiceRecord[];
  bookingTypes: BookingType[];
  calls: RecentCall[];
  bookings: BookingRecord[];
  leads: LeadRecord[];
}

export interface PersistVoiceOutcomeInput {
  workspaceId: string;
  externalId?: string;
  caller: string;
  channel: CallChannel;
  intent: IntentType;
  outcome: CallOutcome;
  confidence: number;
  durationSeconds: number;
  latencyMs: number;
  summary: string;
  transcript: TranscriptTurn[];
  trustedSources: string[];
  actionSummary: string;
  requiresHandoff: boolean;
  matches: Array<{ type: string; label: string; detail: string }>;
}

export interface CreateLeadInput {
  workspaceId: string;
  customer: string;
  interest: string;
  owner: string;
  channel: CallChannel;
  notes?: string;
  status?: "new" | "qualified" | "handoff";
}

export interface CreateBookingInput {
  workspaceId: string;
  customer: string;
  type: string;
  slotAt: Date;
  externalEventId?: string;
  channel: CallChannel;
  notes?: string;
  status?: "confirmed" | "awaiting-confirmation" | "cancelled";
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function asTranscriptTurns(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is TranscriptTurn => {
    if (typeof entry !== "object" || entry === null) {
      return false;
    }

    const record = entry as Record<string, unknown>;
    return (
      typeof record.speaker === "string" &&
      typeof record.text === "string" &&
      typeof record.timestamp === "string"
    );
  });
}

function mapBusinessMode(mode: PrismaBusinessMode): WorkspaceProfile["mode"] {
  if (mode === PrismaBusinessMode.PRODUCT) {
    return "product";
  }

  if (mode === PrismaBusinessMode.SERVICE) {
    return "service";
  }

  return "hybrid";
}

function mapCallChannel(channel: PrismaCallChannel): CallChannel {
  return channel === PrismaCallChannel.PHONE ? "phone" : "whatsapp-voice";
}

function mapCallOutcome(outcome: PrismaCallOutcome): CallOutcome {
  if (outcome === PrismaCallOutcome.BOOKED) {
    return "booked";
  }

  if (outcome === PrismaCallOutcome.LEAD_CAPTURED) {
    return "lead-captured";
  }

  if (outcome === PrismaCallOutcome.HANDOFF) {
    return "handoff";
  }

  return "resolved";
}

function mapLeadStatus(status: PrismaLeadStatus): LeadRecord["status"] {
  if (status === PrismaLeadStatus.QUALIFIED) {
    return "qualified";
  }

  if (status === PrismaLeadStatus.HANDOFF) {
    return "handoff";
  }

  return "new";
}

function mapBookingStatus(status: PrismaBookingStatus): BookingRecord["status"] {
  return status === PrismaBookingStatus.CONFIRMED
    ? "confirmed"
    : "awaiting-confirmation";
}

function mapKnowledgeSourceType(value: string): KnowledgeSource["type"] {
  if (value === "STRUCTURED_SERVICE") {
    return "structured-service";
  }

  return value.toLowerCase() as KnowledgeSource["type"];
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatBookingSlot(date: Date, timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: timezone,
  }).format(date);
  const dayMonth = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);

  return `${weekday}, ${dayMonth} - ${time}`;
}

function fallbackOperationalData(): WorkspaceOperationalData {
  return {
    workspaceId: DEFAULT_TENANT_ID,
    profile: {
      name: mockWorkspaceProfile.name,
      workspaceName: mockWorkspaceProfile.workspaceName,
      mode: mockWorkspaceProfile.mode as WorkspaceProfile["mode"],
      timezone: mockWorkspaceProfile.timezone,
      stack: clone(mockWorkspaceProfile.stack),
      summary: mockWorkspaceProfile.summary,
      handoffTarget: "Enterprise sales desk",
      voiceGreeting:
        "Thanks for calling Atelier Workspace. I can help with product questions, consultation bookings, or get a team member to call you back. How can I help?",
    },
    knowledgeSources: clone(mockKnowledgeSources),
    products: clone(mockProductCatalog),
    services: clone(mockServiceCatalog),
    bookingTypes: clone(mockBookingTypes),
    calls: clone(mockRecentCalls),
    bookings: clone(mockBookings),
    leads: clone(mockLeadCaptures),
  };
}

function dateMinutesAgo(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60000);
}

function nextWeekdaySlot(weekday: number, hour: number, minute = 0) {
  const now = new Date();
  const date = new Date(now);
  const deltaDays = (weekday - now.getDay() + 7) % 7 || 7;

  date.setDate(now.getDate() + deltaDays);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function seedDefaultWorkspace() {
  if (!isDatabaseConfigured() || env.NODE_ENV === "test") {
    return;
  }

  const prisma = getPrismaClient();
  const business = await prisma.business.upsert({
    where: { slug: "atelier" },
    update: {
      name: mockWorkspaceProfile.name,
      mode: PrismaBusinessMode.HYBRID,
      timezone: mockWorkspaceProfile.timezone,
    },
    create: {
      name: mockWorkspaceProfile.name,
      slug: "atelier",
      mode: PrismaBusinessMode.HYBRID,
      timezone: mockWorkspaceProfile.timezone,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: DEFAULT_TENANT_ID },
    update: {
      name: mockWorkspaceProfile.workspaceName,
      summary: mockWorkspaceProfile.summary,
      voiceGreeting:
        "Thanks for calling Atelier Workspace. I can help with product questions, consultation bookings, or get a team member to call you back. How can I help?",
      handoffTarget: "Enterprise sales desk",
      businessId: business.id,
    },
    create: {
      businessId: business.id,
      slug: DEFAULT_TENANT_ID,
      name: mockWorkspaceProfile.workspaceName,
      summary: mockWorkspaceProfile.summary,
      voiceGreeting:
        "Thanks for calling Atelier Workspace. I can help with product questions, consultation bookings, or get a team member to call you back. How can I help?",
      handoffTarget: "Enterprise sales desk",
    },
  });

  const agentCount = await prisma.agent.count({
    where: { workspaceId: workspace.id },
  });

  if (agentCount === 0) {
    await prisma.agent.create({
      data: {
        workspaceId: workspace.id,
        name: "Dialiq Front Desk",
        greeting: workspace.voiceGreeting,
        tone: "Professional, calm, and concise.",
      },
    });
  }

  const knowledgeCount = await prisma.knowledgeSource.count({
    where: { workspaceId: workspace.id },
  });

  if (knowledgeCount === 0) {
    await prisma.knowledgeSource.createMany({
      data: mockKnowledgeSources.map((source) => ({
        workspaceId: workspace.id,
        name: source.name,
        type:
          source.type === "website"
            ? "WEBSITE"
            : source.type === "faq"
              ? "FAQ"
              : source.type === "pdf"
                ? "PDF"
                : source.type === "catalog"
                  ? "CATALOG"
                  : source.type === "structured-service"
                    ? "STRUCTURED_SERVICE"
                    : "DOCUMENT",
        status: source.status,
        items: source.items,
        coverage: source.coverage,
        trustedFields: toJsonValue(source.trustedFields),
      })),
    });
  }

  const productCount = await prisma.product.count({
    where: { workspaceId: workspace.id },
  });

  if (productCount === 0) {
    await prisma.product.createMany({
      data: mockProductCatalog.map((product) => ({
        workspaceId: workspace.id,
        externalId: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        colors: toJsonValue(product.colors),
        features: toJsonValue(product.features),
        stockStatus: product.stockStatus,
        trustedFields: toJsonValue(product.trustedFields),
      })),
    });
  }

  const serviceCount = await prisma.serviceOffering.count({
    where: { workspaceId: workspace.id },
  });

  if (serviceCount === 0) {
    await prisma.serviceOffering.createMany({
      data: mockServiceCatalog.map((service) => ({
        workspaceId: workspace.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        bookingWindow: service.bookingWindow,
        priceRange: service.priceRange,
        status: service.status,
      })),
    });
  }

  const bookingTypeCount = await prisma.bookingTypeConfig.count({
    where: { workspaceId: workspace.id },
  });

  if (bookingTypeCount === 0) {
    await prisma.bookingTypeConfig.createMany({
      data: mockBookingTypes.map((bookingType) => ({
        workspaceId: workspace.id,
        name: bookingType.name,
        durationMinutes: bookingType.durationMinutes,
        slotLabels: toJsonValue(bookingType.availability.split(", ")),
        confirmationRule: bookingType.confirmationRule,
        status: bookingType.status,
      })),
    });
  }

  const bookingCount = await prisma.booking.count({
    where: { workspaceId: workspace.id },
  });

  if (bookingCount === 0) {
    await prisma.booking.createMany({
      data: [
        {
          workspaceId: workspace.id,
          customer: "Jonas Meyer",
          type: "Discovery call",
          slotAt: nextWeekdaySlot(2, 14, 0),
          channel: "WHATSAPP_VOICE",
          status: "CONFIRMED",
        },
        {
          workspaceId: workspace.id,
          customer: "Saskia Blum",
          type: "Showroom consultation",
          slotAt: nextWeekdaySlot(4, 18, 15),
          channel: "PHONE",
          status: "CONFIRMED",
        },
        {
          workspaceId: workspace.id,
          customer: "Luca Weber",
          type: "Installation planning call",
          slotAt: nextWeekdaySlot(5, 9, 30),
          channel: "PHONE",
          status: "AWAITING_CONFIRMATION",
        },
      ],
    });
  }

  const leadCount = await prisma.lead.count({
    where: { workspaceId: workspace.id },
  });

  if (leadCount === 0) {
    await prisma.lead.createMany({
      data: [
        {
          workspaceId: workspace.id,
          customer: "Elena Novak",
          interest: "Faro White Desk",
          status: "QUALIFIED",
          owner: "Sales queue",
          channel: "PHONE",
          createdAt: dateMinutesAgo(12),
        },
        {
          workspaceId: workspace.id,
          customer: "Marvin Roth",
          interest: "Large office chair purchase",
          status: "HANDOFF",
          owner: "Enterprise desk",
          channel: "PHONE",
          createdAt: dateMinutesAgo(54),
        },
        {
          workspaceId: workspace.id,
          customer: "Sienna Hart",
          interest: "Showroom consultation",
          status: "NEW",
          owner: "CSM review",
          channel: "PHONE",
          createdAt: dateMinutesAgo(120),
        },
      ],
    });
  }

  const callCount = await prisma.call.count({
    where: { workspaceId: workspace.id },
  });

  if (callCount === 0) {
    await prisma.call.createMany({
      data: [
        {
          workspaceId: workspace.id,
          externalId: "CALL-2481",
          caller: "Elena Novak",
          channel: "PHONE",
          outcome: "LEAD_CAPTURED",
          intent: "product-inquiry",
          summary:
            "Asked for white desks under 200 euros. AI found two verified matches, read the prices, and saved a callback lead for the sales rep.",
          durationSeconds: 212,
          latencyMs: 720,
          confidence: 0.94,
          transcript: toJsonValue(mockRecentCalls[0].transcript),
          trustedSources: toJsonValue(["Structured product catalog", "FAQ policies"]),
          actionSummary: "Read verified product data and captured a qualified callback lead.",
          requiresHandoff: false,
          matches: toJsonValue([
            {
              type: "product",
              label: "Astra White Desk",
              detail: `${formatCurrency(169)} - cable tray, 120 cm top`,
            },
            {
              type: "product",
              label: "Faro White Desk",
              detail: `${formatCurrency(189)} - storage drawer, 140 cm top`,
            },
          ]),
          createdAt: dateMinutesAgo(12),
        },
        {
          workspaceId: workspace.id,
          externalId: "CALL-2474",
          caller: "Jonas Meyer",
          channel: "WHATSAPP_VOICE",
          outcome: "BOOKED",
          intent: "booking",
          summary:
            "Requested a discovery call for next week. AI offered two verified slots, captured the preferred time, and created a calendar event.",
          durationSeconds: 186,
          latencyMs: 810,
          confidence: 0.91,
          transcript: toJsonValue(mockRecentCalls[1].transcript),
          trustedSources: toJsonValue(["Google Calendar", "Service booking rules"]),
          actionSummary: "Offered verified availability, captured the selected slot, and confirmed the booking.",
          requiresHandoff: false,
          matches: toJsonValue([
            {
              type: "slot",
              label: "Tuesday at 2 PM",
              detail: "Discovery call - calendar slot",
            },
          ]),
          createdAt: dateMinutesAgo(27),
        },
        {
          workspaceId: workspace.id,
          externalId: "CALL-2469",
          caller: "Saskia Blum",
          channel: "PHONE",
          outcome: "RESOLVED",
          intent: "service-inquiry",
          summary:
            "Asked about showroom consultation duration and evening availability. AI answered from service rules and business hours.",
          durationSeconds: 149,
          latencyMs: 560,
          confidence: 0.89,
          transcript: toJsonValue(mockRecentCalls[2].transcript),
          trustedSources: toJsonValue(["Structured service catalog", "Business hours"]),
          actionSummary: "Answered using verified service records only.",
          requiresHandoff: false,
          matches: toJsonValue([
            {
              type: "service",
              label: "Showroom Consultation",
              detail: "45 min - From 80 EUR",
            },
          ]),
          createdAt: dateMinutesAgo(58),
        },
        {
          workspaceId: workspace.id,
          externalId: "CALL-2457",
          caller: "Procurement Desk",
          channel: "PHONE",
          outcome: "HANDOFF",
          intent: "handoff",
          summary:
            "Requested a custom quote for 50 desks with bulk delivery terms. AI declined to guess pricing and routed the call to enterprise sales.",
          durationSeconds: 238,
          latencyMs: 480,
          confidence: 0.63,
          transcript: toJsonValue(mockRecentCalls[3].transcript),
          trustedSources: toJsonValue(["Handoff policy", "Trusted knowledge guardrails"]),
          actionSummary: "Detected a custom quote request and routed to a human.",
          requiresHandoff: true,
          matches: toJsonValue([]),
          createdAt: dateMinutesAgo(104),
        },
      ],
    });
  }
}

function computeDurationSeconds(transcript: TranscriptTurn[]) {
  const callerWords = transcript
    .filter((turn) => turn.speaker === "caller")
    .reduce((total, turn) => total + turn.text.split(/\s+/).filter(Boolean).length, 0);

  return Math.max(30, callerWords * 3);
}

function computeWorkspaceMetrics(calls: RecentCall[], bookings: BookingRecord[], leads: LeadRecord[]): DashboardMetric[] {
  if (calls.length === 0) {
    return clone(mockDashboardMetrics);
  }

  const containedCalls = calls.filter((call) => call.outcome !== "handoff").length;
  const bookingsCompleted = calls.filter((call) => call.outcome === "booked").length;
  const leadCaptures = calls.filter((call) => call.outcome === "lead-captured").length;
  const lowConfidence = calls.filter((call) => call.confidence < 0.75 || call.outcome === "handoff").length;

  return [
    {
      label: "Contained calls",
      value: formatPercent((containedCalls / calls.length) * 100),
      change: `${containedCalls}/${calls.length}`,
      detail: "Resolved without human intervention while staying inside verified knowledge.",
    },
    {
      label: "Booking completion",
      value: formatPercent((bookingsCompleted / calls.length) * 100),
      change: `${bookings.length} live`,
      detail: "Calls that reached a confirmed booking after intent detection and confirmation.",
    },
    {
      label: "Lead capture rate",
      value: String(leads.length),
      change: `+${leadCaptures} from calls`,
      detail: "Qualified leads saved from calls that did not convert immediately.",
    },
    {
      label: "Low-confidence escalations",
      value: formatPercent((lowConfidence / calls.length) * 100),
      change: `${lowConfidence} routed`,
      detail: "Calls intentionally handed off because the AI could not verify enough context safely.",
    },
  ];
}

function computeIntentMix(calls: RecentCall[]): AnalyticsBar[] {
  const counts = new Map<string, number>();

  for (const call of calls) {
    counts.set(call.intent, (counts.get(call.intent) ?? 0) + 1);
  }

  const labelMap: Record<string, string> = {
    booking: "Booking intent",
    "product-inquiry": "Product Q&A",
    "service-inquiry": "Service Q&A",
    handoff: "Escalations",
    "lead-capture": "Lead capture",
    general: "General",
  };

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([intent, value]) => ({
      label: labelMap[intent] ?? intent,
      value,
      detail: `${value} calls`,
    }));
}

function computeWeeklyVolume(calls: RecentCall[]): WeeklyVolumePoint[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const volume = new Map(days.map((day) => [day, { calls: 0, bookings: 0 }]));

  for (const call of calls) {
    const date = new Date(call.capturedAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const day = days[(date.getUTCDay() + 6) % 7];
    const item = volume.get(day);

    if (!item) {
      continue;
    }

    item.calls += 1;
    if (call.outcome === "booked") {
      item.bookings += 1;
    }
  }

  return days.map((day) => ({
    day,
    calls: volume.get(day)?.calls ?? 0,
    bookings: volume.get(day)?.bookings ?? 0,
  }));
}

async function readWorkspaceOperationalData(tenantId = DEFAULT_TENANT_ID): Promise<WorkspaceOperationalData> {
  if (!isDatabaseConfigured() || env.NODE_ENV === "test") {
    return fallbackOperationalData();
  }

  try {
    if (tenantId === DEFAULT_TENANT_ID) {
      await withDatabaseTimeout(seedDefaultWorkspace(), "Default workspace seed");
    }

    const prisma = getPrismaClient();
    const workspace = await withDatabaseTimeout(
      prisma.workspace.findUnique({
        where: { slug: tenantId },
        include: {
          business: true,
          knowledgeSources: {
            orderBy: { createdAt: "asc" },
          },
          products: {
            where: { isActive: true },
            orderBy: [{ category: "asc" }, { price: "asc" }],
          },
          services: {
            orderBy: { name: "asc" },
          },
          bookingTypes: {
            orderBy: { createdAt: "asc" },
          },
          calls: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          bookings: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          leads: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      }),
      "Workspace operational read",
    );

    if (!workspace) {
      throw new AppError(`Workspace "${tenantId}" was not found.`, {
        statusCode: 404,
        code: "WORKSPACE_NOT_FOUND",
      });
    }

    const timezone = workspace.business.timezone;

    return {
      workspaceId: workspace.id,
      profile: {
        name: workspace.business.name,
        workspaceName: workspace.name,
        mode: mapBusinessMode(workspace.business.mode),
        timezone,
        stack: clone(mockWorkspaceProfile.stack),
        summary: workspace.summary,
        handoffTarget: workspace.handoffTarget,
        voiceGreeting: workspace.voiceGreeting,
      },
      knowledgeSources: workspace.knowledgeSources.map((source) => ({
        id: source.id,
        name: source.name,
        type: mapKnowledgeSourceType(source.type),
        status: source.status as KnowledgeSource["status"],
        items: source.items,
        coverage: source.coverage,
        lastSynced: source.lastSyncedAt ? formatRelativeTime(source.lastSyncedAt) : "Not synced",
        trustedFields: asStringArray(source.trustedFields),
      })),
      products: workspace.products.map((product) => ({
        id: product.externalId ?? product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        colors: asStringArray(product.colors),
        features: asStringArray(product.features),
        stockStatus:
          product.stockStatus === "connected-live" ? "connected-live" : "not-connected",
        trustedFields: asStringArray(product.trustedFields),
      })),
      services: workspace.services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        bookingWindow: service.bookingWindow,
        priceRange: service.priceRange,
        status: service.status as ServiceRecord["status"],
      })),
      bookingTypes: workspace.bookingTypes.map((bookingType) => ({
        id: bookingType.id,
        name: bookingType.name,
        durationMinutes: bookingType.durationMinutes,
        availability: asStringArray(bookingType.slotLabels).join(", "),
        confirmationRule: bookingType.confirmationRule,
        status: bookingType.status as BookingType["status"],
      })),
      calls: workspace.calls.map((call) => ({
        id: call.externalId ?? call.id,
        caller: call.caller,
        channel: mapCallChannel(call.channel),
        outcome: mapCallOutcome(call.outcome),
        intent: call.intent as IntentType,
        summary: call.summary,
        durationSeconds: call.durationSeconds,
        confidence: call.confidence,
        capturedAt: call.createdAt.toISOString(),
        handoffTarget: call.requiresHandoff ? workspace.handoffTarget : undefined,
        trustedSources: asStringArray(call.trustedSources),
        actionSummary: call.actionSummary ?? undefined,
        latencyMs: call.latencyMs,
        transcript: asTranscriptTurns(call.transcript),
      })),
      bookings: workspace.bookings.map((booking) => ({
        id: booking.id,
        customer: booking.customer,
        type: booking.type,
        slot: formatBookingSlot(booking.slotAt, timezone),
        source: mapCallChannel(booking.channel),
        status: mapBookingStatus(booking.status),
      })),
      leads: workspace.leads.map((lead) => ({
        id: lead.id,
        customer: lead.customer,
        interest: lead.interest,
        status: mapLeadStatus(lead.status),
        owner: lead.owner,
        capturedAt: formatRelativeTime(lead.createdAt),
      })),
    };
  } catch (error) {
    logError("workspace_operations.read_failed", error, {
      tenantId,
      mockMode: appConfig.isMockMode,
    });

    if (appConfig.isMockMode) {
      return fallbackOperationalData();
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Workspace data is temporarily unavailable.", {
      statusCode: 503,
      code: "WORKSPACE_DATA_UNAVAILABLE",
      expose: true,
    });
  }
}

function intentDisplayDetail(intent: IntentType) {
  switch (intent) {
    case "booking":
      return "Booking or appointment flow";
    case "product-inquiry":
      return "Catalog-backed product query";
    case "service-inquiry":
      return "Service or policy question";
    case "lead-capture":
      return "Lead capture or callback request";
    case "handoff":
      return "Routed to human fallback";
    default:
      return "General call traffic";
  }
}

export async function getWorkspaceOperationalSnapshot(tenantId = DEFAULT_TENANT_ID) {
  const data = await readWorkspaceOperationalData(tenantId);

  return {
    profile: data.profile,
    metrics: computeWorkspaceMetrics(data.calls, data.bookings, data.leads),
    onboarding: clone(onboardingChecklist),
    pipeline: clone(voicePipeline),
    calls: data.calls.map((call) => ({
      ...call,
      capturedAt: Number.isNaN(new Date(call.capturedAt).getTime())
        ? call.capturedAt
        : formatRelativeTime(new Date(call.capturedAt)),
    })),
    leads: data.leads,
    bookings: data.bookings,
  };
}

export async function getKnowledgeOperationalSnapshot(tenantId = DEFAULT_TENANT_ID) {
  const data = await readWorkspaceOperationalData(tenantId);

  return {
    sources: data.knowledgeSources,
    products: data.products,
    services: data.services,
  };
}

export async function getIntegrationOperationalSnapshot(tenantId = DEFAULT_TENANT_ID) {
  const data = await readWorkspaceOperationalData(tenantId);

  return {
    integrations: clone(mockIntegrations),
    bookingTypes: data.bookingTypes,
  };
}

export async function getAgentOperationalSnapshot(tenantId = DEFAULT_TENANT_ID) {
  const data = await readWorkspaceOperationalData(tenantId);
  const rules: AgentRule[] = [
    {
      title: "Answer only from verified business data",
      description:
        "Prices, product features, service durations, availability, and policies must come from connected knowledge or structured records.",
      status: "healthy",
    },
    {
      title: "Confirm every booking before writing",
      description:
        "Slot reads are allowed, but event creation only happens after the caller repeats or accepts the exact proposed time.",
      status: "healthy",
    },
    {
      title: "Escalate low-confidence and edge cases",
      description:
        "Bulk quotes, live stock questions, and custom delivery promises route to a human instead of guessing.",
      status: "warning",
    },
    {
      title: "Keep responses short and sequential",
      description:
        "The voice agent asks one follow-up at a time, avoids long explanations, and never turns into chatbot-style paragraphs.",
      status: "healthy",
    },
  ];

  return {
    profile: data.profile,
    rules: clone(rules),
    pipeline: clone(voicePipeline),
  };
}

export async function getAnalyticsOperationalSnapshot(tenantId = DEFAULT_TENANT_ID) {
  if (!isDatabaseConfigured()) {
    return {
      metrics: clone(mockDashboardMetrics),
      intentMix: clone(mockAnalyticsBreakdown),
      weeklyVolume: clone(mockWeeklyVolume),
    };
  }

  const data = await readWorkspaceOperationalData(tenantId);

  return {
    metrics: computeWorkspaceMetrics(data.calls, data.bookings, data.leads),
    intentMix:
      data.calls.length > 0
        ? computeIntentMix(data.calls).map((item) => ({
            ...item,
            detail: intentDisplayDetail(
              item.label === "Booking intent"
                ? "booking"
                : item.label === "Product Q&A"
                  ? "product-inquiry"
                  : item.label === "Service Q&A"
                    ? "service-inquiry"
                    : item.label === "Lead capture"
                      ? "lead-capture"
                      : item.label === "Escalations"
                        ? "handoff"
                        : "general",
            ),
          }))
        : [],
    weeklyVolume:
      data.calls.length > 0
        ? computeWeeklyVolume(data.calls)
        : clone(mockWeeklyVolume),
  };
}

export async function getTeamOperationalSnapshot(tenantId = DEFAULT_TENANT_ID) {
  const data = await readWorkspaceOperationalData(tenantId);

  return {
    members: clone(teamMembers),
    leads: data.leads,
  };
}

export async function loadVoiceWorkspaceContext(tenantId = DEFAULT_TENANT_ID) {
  return readWorkspaceOperationalData(tenantId);
}

export async function createLeadRecord(input: CreateLeadInput) {
  if (!isDatabaseConfigured() || env.NODE_ENV === "test" || appConfig.isMockMode) {
    return {
      id: `lead-${Date.now()}`,
    };
  }

  const prisma = getPrismaClient();
  const lead = await withDatabaseTimeout(
    prisma.lead.create({
      data: {
        workspaceId: input.workspaceId,
        customer: input.customer,
        interest: input.interest,
        owner: input.owner,
        channel: input.channel === "phone" ? "PHONE" : "WHATSAPP_VOICE",
        notes: input.notes,
        status:
          input.status === "qualified"
            ? "QUALIFIED"
            : input.status === "handoff"
              ? "HANDOFF"
              : "NEW",
      },
    }),
    "Lead record create",
  );

  return lead;
}

export async function createBookingRecord(input: CreateBookingInput) {
  if (!isDatabaseConfigured() || env.NODE_ENV === "test" || appConfig.isMockMode) {
    return {
      id: `booking-${Date.now()}`,
    };
  }

  const prisma = getPrismaClient();
  const booking = await withDatabaseTimeout(
    prisma.booking.create({
      data: {
        workspaceId: input.workspaceId,
        customer: input.customer,
        type: input.type,
        slotAt: input.slotAt,
        externalEventId: input.externalEventId,
        channel: input.channel === "phone" ? "PHONE" : "WHATSAPP_VOICE",
        notes: input.notes,
        status:
          input.status === "cancelled"
            ? "CANCELLED"
            : input.status === "awaiting-confirmation"
              ? "AWAITING_CONFIRMATION"
              : "CONFIRMED",
      },
    }),
    "Booking record create",
  );

  return booking;
}

export async function persistVoiceOutcome(input: PersistVoiceOutcomeInput) {
  if (!isDatabaseConfigured() || env.NODE_ENV === "test" || appConfig.isMockMode) {
    return {
      id: input.externalId ?? `call-${Date.now()}`,
      durationSeconds: input.durationSeconds || computeDurationSeconds(input.transcript),
    };
  }

  const prisma = getPrismaClient();
  const call = await withDatabaseTimeout(
    prisma.call.create({
      data: {
        workspaceId: input.workspaceId,
        externalId: input.externalId,
        caller: input.caller,
        channel: input.channel === "phone" ? "PHONE" : "WHATSAPP_VOICE",
        outcome:
          input.outcome === "booked"
            ? "BOOKED"
            : input.outcome === "lead-captured"
              ? "LEAD_CAPTURED"
              : input.outcome === "handoff"
                ? "HANDOFF"
                : "RESOLVED",
        intent: input.intent,
        summary: input.summary,
        durationSeconds: input.durationSeconds || computeDurationSeconds(input.transcript),
        latencyMs: input.latencyMs,
        confidence: input.confidence,
        transcript: toJsonValue(input.transcript),
        trustedSources: toJsonValue(input.trustedSources),
        actionSummary: input.actionSummary,
        requiresHandoff: input.requiresHandoff,
        matches: toJsonValue(input.matches),
      },
    }),
    "Voice outcome persistence",
  );

  return call;
}

export async function getOperationalCounts(tenantId = DEFAULT_TENANT_ID) {
  const data = await readWorkspaceOperationalData(tenantId);

  return {
    calls: data.calls.length,
    bookings: data.bookings.length,
    leads: data.leads.length,
    products: data.products.length,
    services: data.services.length,
  };
}
