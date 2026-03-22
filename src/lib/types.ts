export type HealthStatus = "healthy" | "warning" | "critical" | "inactive";
export type BusinessMode = "product" | "service" | "hybrid";
export type CallChannel = "phone" | "whatsapp-voice";
export type CallOutcome =
  | "resolved"
  | "booked"
  | "lead-captured"
  | "handoff";
export type IntentType =
  | "product-inquiry"
  | "service-inquiry"
  | "booking"
  | "lead-capture"
  | "handoff"
  | "general";
export type KnowledgeSourceType =
  | "website"
  | "faq"
  | "pdf"
  | "catalog"
  | "document"
  | "structured-service";
export type KnowledgeDocumentKind = "website-page" | "markdown" | "pdf";
export type IntegrationCategory =
  | "channel"
  | "stt"
  | "llm"
  | "tts"
  | "calendar"
  | "crm"
  | "knowledge";

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  detail: string;
}

export interface WorkspaceProfile {
  name: string;
  workspaceName: string;
  mode: BusinessMode;
  timezone: string;
  stack: string[];
  summary: string;
  handoffTarget?: string;
  voiceGreeting?: string;
}

export interface ChecklistItem {
  title: string;
  description: string;
  status: "done" | "in-progress" | "pending";
}

export interface PipelineStage {
  id: string;
  name: string;
  provider: string;
  description: string;
  reliabilityRule: string;
  status: HealthStatus;
}

export interface TranscriptTurn {
  speaker: "caller" | "agent" | "system";
  text: string;
  timestamp: string;
  tool?: string;
}

export interface RecentCall {
  id: string;
  caller: string;
  channel: CallChannel;
  outcome: CallOutcome;
  intent: IntentType;
  summary: string;
  durationSeconds: number;
  confidence: number;
  capturedAt: string;
  handoffTarget?: string;
  trustedSources?: string[];
  actionSummary?: string;
  latencyMs?: number;
  transcript: TranscriptTurn[];
}

export interface KnowledgeSource {
  id: string;
  name: string;
  type: KnowledgeSourceType;
  status: HealthStatus;
  items: number;
  lastSynced: string;
  coverage: number;
  trustedFields: string[];
  sourceUrl?: string | null;
}

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  kind: KnowledgeDocumentKind;
  sourceLabel: string;
  excerpt: string;
  chunkCount: number;
  updatedAt: string;
  sourceUrl?: string | null;
}

export interface ProductRecord {
  id: string;
  name: string;
  category: string;
  price: number;
  colors: string[];
  features: string[];
  stockStatus: "connected-live" | "not-connected";
  trustedFields: string[];
}

export interface ServiceRecord {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  bookingWindow: string;
  priceRange: string;
  status: HealthStatus;
}

export interface IntegrationConnection {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: HealthStatus;
  detail: string;
  lastChecked: string;
  scopes: string[];
}

export interface BookingType {
  id: string;
  name: string;
  durationMinutes: number;
  availability: string;
  confirmationRule: string;
  status: HealthStatus;
}

export interface BookingRecord {
  id: string;
  customer: string;
  type: string;
  slot: string;
  source: CallChannel;
  status: "confirmed" | "awaiting-confirmation";
}

export interface LeadRecord {
  id: string;
  customer: string;
  interest: string;
  status: "qualified" | "new" | "handoff";
  owner: string;
  capturedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  coverage: string;
  handoffWindow: string;
  status: HealthStatus;
}

export interface AnalyticsBar {
  label: string;
  value: number;
  detail: string;
}

export interface WeeklyVolumePoint {
  day: string;
  calls: number;
  bookings: number;
}

export interface AgentRule {
  title: string;
  description: string;
  status: HealthStatus;
}

export interface ProviderCredential {
  id: string;
  provider: string;
  configKey: string;
  purpose: string;
  status: HealthStatus;
  maskedValue: string;
  environment: string;
  lastValidated: string;
  nextRotation: string;
  source?: "database" | "environment" | "mock" | "mixed";
  isEnabled?: boolean;
  validationMessage?: string | null;
}

export interface TenantRecord {
  id: string;
  name: string;
  mode: BusinessMode;
  plan: string;
  channels: string;
  callVolume: string;
  onboarding: string;
  riskLevel: HealthStatus;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  occurredAt: string;
  status: HealthStatus;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  state: "enabled" | "gradual" | "disabled";
}

export interface VoiceWebhookPayload {
  tenantId: string;
  channel: CallChannel;
  caller: string;
  transcript: string;
  callId?: string;
  bookingType?: string;
  selectedSlot?: string;
}

export interface VoiceCallMatch {
  type: "product" | "service" | "slot" | "knowledge";
  label: string;
  detail: string;
}

export interface VoiceCallResult {
  callId: string;
  intent: IntentType;
  outcome: CallOutcome;
  confidence: number;
  latencyMs: number;
  responseText: string;
  trustedSources: string[];
  actionSummary: string;
  requiresHandoff: boolean;
  handoffTarget?: string;
  bookingId?: string;
  leadId?: string;
  matches: VoiceCallMatch[];
  pipeline: PipelineStage[];
}

export type VoiceSimulationMatch = VoiceCallMatch;
export type VoiceSimulationResponse = VoiceCallResult;
