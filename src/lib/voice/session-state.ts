import type { IntentType, TranscriptTurn, VoiceCallMatch, VoiceWebhookPayload } from "@/lib/types";

const SESSION_TTL_MS = 20 * 60 * 1000;
const MAX_RECENT_TURNS = 8;

export interface VoiceSessionOfferedSlot {
  bookingTypeId: string;
  bookingTypeName: string;
  raw: string;
  spoken: string;
  startIso: string;
  endIso: string;
}

export interface VoiceSessionState {
  key: string;
  tenantId: string;
  caller: string;
  lastIntent?: IntentType;
  lastMatches: VoiceCallMatch[];
  lastResponseText?: string;
  lastBookingTypeId?: string;
  lastBookingTypeName?: string;
  offeredSlots: VoiceSessionOfferedSlot[];
  recentTurns: TranscriptTurn[];
  updatedAt: number;
}

const sessions = new Map<string, VoiceSessionState>();

function sessionKey(input: Pick<VoiceWebhookPayload, "tenantId" | "caller" | "callId">) {
  return input.callId
    ? `call:${input.callId}`
    : `caller:${input.tenantId}:${input.caller.trim().toLowerCase()}`;
}

function trimRecentTurns(turns: TranscriptTurn[]) {
  return turns.slice(-MAX_RECENT_TURNS);
}

function isExpired(session: VoiceSessionState) {
  return Date.now() - session.updatedAt > SESSION_TTL_MS;
}

function createSession(input: Pick<VoiceWebhookPayload, "tenantId" | "caller" | "callId">): VoiceSessionState {
  return {
    key: sessionKey(input),
    tenantId: input.tenantId,
    caller: input.caller,
    lastMatches: [],
    offeredSlots: [],
    recentTurns: [],
    updatedAt: Date.now(),
  };
}

export function getVoiceSession(input: Pick<VoiceWebhookPayload, "tenantId" | "caller" | "callId">) {
  const key = sessionKey(input);
  const existing = sessions.get(key);

  if (existing && !isExpired(existing)) {
    return existing;
  }

  const session = createSession(input);
  sessions.set(key, session);
  return session;
}

export function updateVoiceSession(
  input: Pick<VoiceWebhookPayload, "tenantId" | "caller" | "callId">,
  update: Partial<Omit<VoiceSessionState, "key" | "tenantId" | "caller">>,
) {
  const session = getVoiceSession(input);

  if (update.lastIntent !== undefined) {
    session.lastIntent = update.lastIntent;
  }

  if (update.lastMatches !== undefined) {
    session.lastMatches = update.lastMatches;
  }

  if (update.lastResponseText !== undefined) {
    session.lastResponseText = update.lastResponseText;
  }

  if (update.lastBookingTypeId !== undefined) {
    session.lastBookingTypeId = update.lastBookingTypeId;
  }

  if (update.lastBookingTypeName !== undefined) {
    session.lastBookingTypeName = update.lastBookingTypeName;
  }

  if (update.offeredSlots !== undefined) {
    session.offeredSlots = update.offeredSlots;
  }

  if (update.recentTurns !== undefined) {
    session.recentTurns = trimRecentTurns(update.recentTurns);
  }

  session.updatedAt = Date.now();
  sessions.set(session.key, session);

  return session;
}

export function appendSessionTurns(
  input: Pick<VoiceWebhookPayload, "tenantId" | "caller" | "callId">,
  turns: TranscriptTurn[],
) {
  const session = getVoiceSession(input);
  session.recentTurns = trimRecentTurns([...session.recentTurns, ...turns]);
  session.updatedAt = Date.now();
  sessions.set(session.key, session);
  return session;
}

export function clearVoiceSession(input: Pick<VoiceWebhookPayload, "tenantId" | "caller" | "callId">) {
  sessions.delete(sessionKey(input));
}

export function clearAllVoiceSessions() {
  sessions.clear();
}
