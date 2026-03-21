import type {
  AgentRule,
  AnalyticsBar,
  AuditEvent,
  BookingRecord,
  BookingType,
  ChecklistItem,
  DashboardMetric,
  FeatureFlag,
  IntegrationConnection,
  KnowledgeSource,
  LeadRecord,
  PipelineStage,
  ProductRecord,
  ProviderCredential,
  RecentCall,
  ServiceRecord,
  TeamMember,
  TenantRecord,
  WeeklyVolumePoint,
} from "@/lib/types";

export const workspaceProfile = {
  name: "Atelier Workspace",
  workspaceName: "Atelier HQ",
  mode: "hybrid",
  timezone: "Europe/Berlin",
  stack: ["Twilio Voice", "WhatsApp Calling", "Deepgram Flux", "OpenRouter", "ElevenLabs"],
  summary:
    "A voice-first workspace for inbound furniture sales, service consultations, appointment booking, and safe lead capture.",
};

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: "Contained calls",
    value: "94.2%",
    change: "+4.8%",
    detail: "Resolved without human intervention while staying inside verified knowledge.",
  },
  {
    label: "Booking completion",
    value: "81%",
    change: "+9%",
    detail: "Calls that reached a confirmed Google Calendar booking after intent detection.",
  },
  {
    label: "Lead capture rate",
    value: "128",
    change: "+23",
    detail: "Qualified leads saved this month from voice calls that did not convert immediately.",
  },
  {
    label: "Low-confidence escalations",
    value: "6.4%",
    change: "-2.1%",
    detail: "Calls intentionally handed off because the AI could not verify enough context safely.",
  },
];

export const onboardingChecklist: ChecklistItem[] = [
  {
    title: "Connect Twilio inbound routes",
    description:
      "Primary number and WhatsApp voice path are active, with webhook routing tied to the tenant context.",
    status: "done",
  },
  {
    title: "Review knowledge trust coverage",
    description:
      "Structured catalog, FAQs, and service rules are synced. Shipping ETA is still gated until live inventory is wired in.",
    status: "in-progress",
  },
  {
    title: "Connect Google Calendar",
    description:
      "Consultation and discovery-call calendars are linked with booking confirmation rules enabled.",
    status: "done",
  },
  {
    title: "Set CRM lead routing",
    description:
      "Lead capture is prepared for HubSpot, but owner mapping still needs confirmation for sales teams.",
    status: "pending",
  },
];

export const voicePipeline: PipelineStage[] = [
  {
    id: "route",
    name: "Inbound routing",
    provider: "Twilio",
    description:
      "Accepts phone calls and WhatsApp calling, identifies the business, and attaches the correct workspace context.",
    reliabilityRule:
      "Reject unsupported channels and keep tenant resolution deterministic before any AI step runs.",
    status: "healthy",
  },
  {
    id: "listen",
    name: "Speech-to-text",
    provider: "Deepgram Flux",
    description:
      "Streams the call audio, detects turns, and produces transcripts optimized for real-time voice handling.",
    reliabilityRule:
      "Each transcript chunk keeps confidence signals so low-certainty turns can trigger clarification or fallback.",
    status: "healthy",
  },
  {
    id: "reason",
    name: "Intent and policy reasoning",
    provider: "Deterministic fast path + OpenRouter",
    description:
      "Classifies product, service, booking, or lead intents with a fast policy path first, then leaves room for OpenRouter on ambiguous turns once live providers are wired.",
    reliabilityRule:
      "No answer may include prices, stock, or availability unless those fields exist in connected structured sources and the policy engine allows them.",
    status: "healthy",
  },
  {
    id: "act",
    name: "Knowledge and actions",
    provider: "Structured data + Google Calendar + CRM",
    description:
      "Searches the business knowledge layer, proposes booking slots, and logs leads or handoff decisions.",
    reliabilityRule:
      "Every mutation requires confirmation and every result is logged before a spoken response is generated.",
    status: "warning",
  },
  {
    id: "speak",
    name: "Voice response",
    provider: "ElevenLabs",
    description:
      "Converts the final short response into natural voice while maintaining a restrained business-call style.",
    reliabilityRule:
      "Responses stay concise, business-appropriate, and aligned with the action outcome that was actually executed.",
    status: "healthy",
  },
];

export const recentCalls: RecentCall[] = [
  {
    id: "CALL-2481",
    caller: "Elena Novak",
    channel: "phone",
    outcome: "lead-captured",
    intent: "product-inquiry",
    summary:
      "Asked for white desks under 200 euros. AI found two verified matches, read the prices, and saved a callback lead for the sales rep.",
    durationSeconds: 212,
    confidence: 0.94,
    capturedAt: "12 min ago",
    transcript: [
      {
        speaker: "caller",
        timestamp: "00:07",
        text: "Do you have any white desks under 200 euros?",
      },
      {
        speaker: "agent",
        timestamp: "00:11",
        text:
          "Yes, I have two verified options. One is 169 euros and the other is 189 euros. I can share more details or log a callback.",
      },
      {
        speaker: "caller",
        timestamp: "00:26",
        text: "Please have someone call me back about the 189 euro desk.",
        tool: "CRM lead capture",
      },
    ],
  },
  {
    id: "CALL-2474",
    caller: "Jonas Meyer",
    channel: "whatsapp-voice",
    outcome: "booked",
    intent: "booking",
    summary:
      "Requested a discovery call for next week. AI offered two verified slots, captured the preferred time, and created a calendar event.",
    durationSeconds: 186,
    confidence: 0.91,
    capturedAt: "27 min ago",
    transcript: [
      {
        speaker: "caller",
        timestamp: "00:05",
        text: "I'd like to schedule a discovery call next week.",
      },
      {
        speaker: "agent",
        timestamp: "00:09",
        text: "I have availability on Tuesday at 2 PM or Thursday at 11 AM. Which would you prefer?",
        tool: "Google Calendar availability",
      },
      {
        speaker: "caller",
        timestamp: "00:18",
        text: "Tuesday at 2 PM works for me.",
      },
      {
        speaker: "agent",
        timestamp: "00:22",
        text: "Perfect. Your discovery call is booked for Tuesday at 2 PM.",
        tool: "Google Calendar create event",
      },
    ],
  },
  {
    id: "CALL-2469",
    caller: "Saskia Blum",
    channel: "phone",
    outcome: "resolved",
    intent: "service-inquiry",
    summary:
      "Asked about showroom consultation duration and evening availability. AI answered from service rules and business hours.",
    durationSeconds: 149,
    confidence: 0.89,
    capturedAt: "58 min ago",
    transcript: [
      {
        speaker: "caller",
        timestamp: "00:03",
        text: "How long is a showroom consultation, and do you have late appointments?",
      },
      {
        speaker: "agent",
        timestamp: "00:10",
        text:
          "The consultation runs for 45 minutes. Verified evening slots are available on Thursdays until 7 PM.",
      },
    ],
  },
  {
    id: "CALL-2457",
    caller: "Procurement Desk",
    channel: "phone",
    outcome: "handoff",
    intent: "handoff",
    summary:
      "Requested a custom quote for 50 desks with bulk delivery terms. AI declined to guess pricing and routed the call to enterprise sales.",
    durationSeconds: 238,
    confidence: 0.63,
    capturedAt: "1h 44m ago",
    handoffTarget: "Enterprise sales desk",
    transcript: [
      {
        speaker: "caller",
        timestamp: "00:14",
        text: "We need a custom quote for 50 desks with delivery to three locations.",
      },
      {
        speaker: "agent",
        timestamp: "00:21",
        text:
          "I can't verify custom bulk pricing from the connected data, so I'm routing you to our enterprise desk now.",
      },
    ],
  },
];

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "KS-01",
    name: "Main website and FAQ",
    type: "website",
    status: "healthy",
    items: 182,
    lastSynced: "8 minutes ago",
    coverage: 91,
    trustedFields: ["service descriptions", "hours", "policies"],
  },
  {
    id: "KS-02",
    name: "Structured product catalog",
    type: "catalog",
    status: "healthy",
    items: 248,
    lastSynced: "22 minutes ago",
    coverage: 97,
    trustedFields: ["price", "color", "features", "category"],
  },
  {
    id: "KS-03",
    name: "Showroom policy PDF",
    type: "pdf",
    status: "warning",
    items: 14,
    lastSynced: "Yesterday",
    coverage: 68,
    trustedFields: ["return windows", "delivery zones"],
  },
  {
    id: "KS-04",
    name: "Service catalog",
    type: "structured-service",
    status: "healthy",
    items: 12,
    lastSynced: "5 minutes ago",
    coverage: 95,
    trustedFields: ["duration", "price range", "booking rules"],
  },
];

export const productCatalog: ProductRecord[] = [
  {
    id: "PRD-101",
    name: "Astra White Desk",
    category: "Desks",
    price: 169,
    colors: ["white", "oak"],
    features: ["cable tray", "120 cm top", "matte finish"],
    stockStatus: "not-connected",
    trustedFields: ["price", "colors", "features"],
  },
  {
    id: "PRD-102",
    name: "Faro White Desk",
    category: "Desks",
    price: 189,
    colors: ["white"],
    features: ["storage drawer", "140 cm top", "powder-coated legs"],
    stockStatus: "not-connected",
    trustedFields: ["price", "colors", "features"],
  },
  {
    id: "PRD-103",
    name: "Luma Black Office Chair",
    category: "Seating",
    price: 249,
    colors: ["black", "graphite"],
    features: ["mesh back", "lumbar support", "lockable castors"],
    stockStatus: "not-connected",
    trustedFields: ["price", "colors", "features"],
  },
  {
    id: "PRD-104",
    name: "Pivot Black Office Chair",
    category: "Seating",
    price: 289,
    colors: ["black"],
    features: ["padded armrests", "synchronous tilt", "headrest"],
    stockStatus: "not-connected",
    trustedFields: ["price", "colors", "features"],
  },
];

export const serviceCatalog: ServiceRecord[] = [
  {
    id: "SRV-01",
    name: "Discovery Call",
    description: "Introductory planning call for office fit-outs and furniture recommendations.",
    durationMinutes: 30,
    bookingWindow: "Tue 14:00, Thu 11:00",
    priceRange: "Free",
    status: "healthy",
  },
  {
    id: "SRV-02",
    name: "Showroom Consultation",
    description: "In-person guided consultation covering layouts, materials, and product selection.",
    durationMinutes: 45,
    bookingWindow: "Mon-Fri 10:00-19:00",
    priceRange: "From 80 EUR",
    status: "healthy",
  },
  {
    id: "SRV-03",
    name: "Installation Planning Call",
    description: "Project coordination call covering delivery readiness and installation constraints.",
    durationMinutes: 20,
    bookingWindow: "Mon-Fri 09:00-17:00",
    priceRange: "Included with project",
    status: "warning",
  },
];

export const integrations: IntegrationConnection[] = [
  {
    id: "INT-01",
    name: "Twilio Voice",
    category: "channel",
    status: "healthy",
    detail: "Primary inbound number and SIP handoff path are active.",
    lastChecked: "2 minutes ago",
    scopes: ["numbers", "voice webhooks", "status callbacks"],
  },
  {
    id: "INT-02",
    name: "WhatsApp Calling",
    category: "channel",
    status: "healthy",
    detail: "Inbound call flow attached to the same workspace routing policy.",
    lastChecked: "2 minutes ago",
    scopes: ["voice routing", "tenant resolution"],
  },
  {
    id: "INT-03",
    name: "Deepgram Flux",
    category: "stt",
    status: "healthy",
    detail: "Real-time streaming transcription with turn confidence enabled.",
    lastChecked: "5 minutes ago",
    scopes: ["streaming STT", "turn-taking"],
  },
  {
    id: "INT-04",
    name: "OpenRouter",
    category: "llm",
    status: "healthy",
    detail: "Default model routing set to gpt-5.4-mini with tool policies enforced in the backend.",
    lastChecked: "5 minutes ago",
    scopes: ["chat completions", "model routing"],
  },
  {
    id: "INT-05",
    name: "ElevenLabs",
    category: "tts",
    status: "healthy",
    detail: "Primary voice locked to a concise business-call persona.",
    lastChecked: "11 minutes ago",
    scopes: ["voice synthesis"],
  },
  {
    id: "INT-06",
    name: "Google Calendar",
    category: "calendar",
    status: "healthy",
    detail: "Two booking types synced with slot lookup and create-event permissions.",
    lastChecked: "7 minutes ago",
    scopes: ["availability.read", "events.write"],
  },
  {
    id: "INT-07",
    name: "HubSpot CRM",
    category: "crm",
    status: "warning",
    detail: "Lead creation is ready, but owner assignment still defaults to queue review.",
    lastChecked: "39 minutes ago",
    scopes: ["contacts.write", "deals.write"],
  },
];

export const bookingTypes: BookingType[] = [
  {
    id: "BKG-01",
    name: "Discovery call",
    durationMinutes: 30,
    availability: "Tue 14:00, Thu 11:00",
    confirmationRule: "Only create after explicit caller confirmation.",
    status: "healthy",
  },
  {
    id: "BKG-02",
    name: "Showroom consultation",
    durationMinutes: 45,
    availability: "Mon-Fri 10:00-19:00",
    confirmationRule: "Ask for preferred location before finalizing.",
    status: "healthy",
  },
  {
    id: "BKG-03",
    name: "Installation planning call",
    durationMinutes: 20,
    availability: "Mon-Fri 09:00-17:00",
    confirmationRule: "Only offer after an active project ID is confirmed.",
    status: "warning",
  },
];

export const bookings: BookingRecord[] = [
  {
    id: "EVT-201",
    customer: "Jonas Meyer",
    type: "Discovery call",
    slot: "Tuesday, 24 Mar - 14:00",
    source: "whatsapp-voice",
    status: "confirmed",
  },
  {
    id: "EVT-198",
    customer: "Saskia Blum",
    type: "Showroom consultation",
    slot: "Thursday, 26 Mar - 18:15",
    source: "phone",
    status: "confirmed",
  },
  {
    id: "EVT-193",
    customer: "Luca Weber",
    type: "Installation planning call",
    slot: "Friday, 27 Mar - 09:30",
    source: "phone",
    status: "awaiting-confirmation",
  },
];

export const leadCaptures: LeadRecord[] = [
  {
    id: "LEAD-77",
    customer: "Elena Novak",
    interest: "Faro White Desk",
    status: "qualified",
    owner: "Sales queue",
    capturedAt: "12 min ago",
  },
  {
    id: "LEAD-74",
    customer: "Marvin Roth",
    interest: "Large office chair purchase",
    status: "handoff",
    owner: "Enterprise desk",
    capturedAt: "54 min ago",
  },
  {
    id: "LEAD-71",
    customer: "Sienna Hart",
    interest: "Showroom consultation",
    status: "new",
    owner: "CSM review",
    capturedAt: "2h ago",
  },
];

export const agentRules: AgentRule[] = [
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

export const analyticsBreakdown: AnalyticsBar[] = [
  { label: "Booking intent", value: 42, detail: "Most common completed path" },
  { label: "Product Q&A", value: 33, detail: "Catalog and FAQ grounded" },
  { label: "Service Q&A", value: 16, detail: "Hours, duration, pricing ranges" },
  { label: "Escalations", value: 9, detail: "Low confidence or custom request" },
];

export const weeklyVolume: WeeklyVolumePoint[] = [
  { day: "Mon", calls: 84, bookings: 16 },
  { day: "Tue", calls: 112, bookings: 24 },
  { day: "Wed", calls: 97, bookings: 19 },
  { day: "Thu", calls: 126, bookings: 27 },
  { day: "Fri", calls: 103, bookings: 18 },
  { day: "Sat", calls: 54, bookings: 6 },
  { day: "Sun", calls: 28, bookings: 2 },
];

export const teamMembers: TeamMember[] = [
  {
    id: "TM-01",
    name: "Leonie Hart",
    role: "Workspace owner",
    coverage: "Pricing, escalations, provider settings",
    handoffWindow: "Mon-Fri - 09:00-18:00",
    status: "healthy",
  },
  {
    id: "TM-02",
    name: "Martin Cole",
    role: "Sales specialist",
    coverage: "Bulk quotes, product callbacks",
    handoffWindow: "Mon-Fri - 10:00-17:00",
    status: "healthy",
  },
  {
    id: "TM-03",
    name: "Aimee Voss",
    role: "Service coordinator",
    coverage: "Bookings, onsite consultations",
    handoffWindow: "Tue-Sat - 10:00-19:00",
    status: "healthy",
  },
];

export const adminMetrics: DashboardMetric[] = [
  {
    label: "Active businesses",
    value: "38",
    change: "+6",
    detail: "Tenants with at least one live inbound route and an attached workspace.",
  },
  {
    label: "Live voice channels",
    value: "71",
    change: "+9",
    detail: "Twilio numbers and WhatsApp calling routes serving inbound traffic right now.",
  },
  {
    label: "24h handled calls",
    value: "3,482",
    change: "+12%",
    detail: "Across all tenants, including booked, resolved, lead-captured, and escalated outcomes.",
  },
  {
    label: "Action failures",
    value: "0.8%",
    change: "-0.4%",
    detail: "Calendar or CRM mutations that failed validation or provider-level execution.",
  },
];

export const providerCredentials: ProviderCredential[] = [
  {
    id: "PV-01",
    provider: "OpenRouter",
    purpose: "LLM routing for gpt-5.4-mini",
    status: "healthy",
    maskedValue: "or-v1-****************8c1a",
    environment: "Production",
    lastValidated: "5 minutes ago",
    nextRotation: "12 Apr 2026",
  },
  {
    id: "PV-02",
    provider: "Deepgram",
    purpose: "Flux streaming speech-to-text",
    status: "healthy",
    maskedValue: "dg_******************91f2",
    environment: "Production",
    lastValidated: "5 minutes ago",
    nextRotation: "03 May 2026",
  },
  {
    id: "PV-03",
    provider: "ElevenLabs",
    purpose: "Voice synthesis for answer playback",
    status: "healthy",
    maskedValue: "xi_*******************02ab",
    environment: "Production",
    lastValidated: "11 minutes ago",
    nextRotation: "29 Apr 2026",
  },
  {
    id: "PV-04",
    provider: "Twilio",
    purpose: "Inbound telephony and WhatsApp calling",
    status: "healthy",
    maskedValue: "AC***********************47",
    environment: "Production",
    lastValidated: "2 minutes ago",
    nextRotation: "15 Apr 2026",
  },
  {
    id: "PV-05",
    provider: "Google",
    purpose: "Calendar OAuth and booking actions",
    status: "warning",
    maskedValue: "oauth-*****************9bb3",
    environment: "Production",
    lastValidated: "7 minutes ago",
    nextRotation: "01 Apr 2026",
  },
  {
    id: "PV-06",
    provider: "HubSpot",
    purpose: "Lead and CRM sync",
    status: "warning",
    maskedValue: "pat-*******************441e",
    environment: "Production",
    lastValidated: "39 minutes ago",
    nextRotation: "10 Apr 2026",
  },
];

export const tenantRecords: TenantRecord[] = [
  {
    id: "TEN-01",
    name: "Atelier Workspace",
    mode: "hybrid",
    plan: "Growth",
    channels: "Phone + WhatsApp",
    callVolume: "482 / week",
    onboarding: "Live",
    riskLevel: "healthy",
  },
  {
    id: "TEN-02",
    name: "Northpeak Clinics",
    mode: "service",
    plan: "Scale",
    channels: "Phone",
    callVolume: "691 / week",
    onboarding: "Live",
    riskLevel: "healthy",
  },
  {
    id: "TEN-03",
    name: "Modo Furnish",
    mode: "product",
    plan: "Starter",
    channels: "Phone",
    callVolume: "214 / week",
    onboarding: "Sync review",
    riskLevel: "warning",
  },
  {
    id: "TEN-04",
    name: "Axis Advisory",
    mode: "service",
    plan: "Growth",
    channels: "WhatsApp calling",
    callVolume: "153 / week",
    onboarding: "OAuth pending",
    riskLevel: "warning",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "AUD-901",
    actor: "Platform admin",
    action: "Rotated provider credential",
    target: "OpenRouter production key",
    occurredAt: "09:12",
    status: "healthy",
  },
  {
    id: "AUD-898",
    actor: "Dialiq worker",
    action: "Blocked unverified shipping promise",
    target: "Atelier Workspace / CALL-2448",
    occurredAt: "08:54",
    status: "warning",
  },
  {
    id: "AUD-887",
    actor: "Platform admin",
    action: "Enabled confirmed booking guard",
    target: "Global feature flag",
    occurredAt: "Yesterday",
    status: "healthy",
  },
  {
    id: "AUD-874",
    actor: "System",
    action: "Detected Google refresh token expiry risk",
    target: "Axis Advisory",
    occurredAt: "Yesterday",
    status: "critical",
  },
];

export const featureFlags: FeatureFlag[] = [
  {
    id: "FF-01",
    name: "Structured retrieval guard",
    description:
      "Force prices, durations, and live-action proposals to come from structured sources before answer generation.",
    state: "enabled",
  },
  {
    id: "FF-02",
    name: "Confirmed booking guard",
    description:
      "Require explicit slot confirmation from the caller before Google Calendar create-event actions run.",
    state: "enabled",
  },
  {
    id: "FF-03",
    name: "After-hours human fallback",
    description:
      "Send unresolved calls to voicemail or next-day callback queue when live staff coverage is closed.",
    state: "gradual",
  },
];
