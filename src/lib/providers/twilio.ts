import { appConfig, env } from "@/lib/config/env";
import { logWarn } from "@/lib/observability/logger";
import twilio from "twilio";

export interface TwilioInboundCallContext {
  tenantId: string;
  caller: string;
  callSid: string;
  channel: "phone" | "whatsapp-voice";
}

function toWebSocketUrl(input: URL) {
  const url = new URL(input.toString());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/realtime/twilio";
  url.search = "";
  return url.toString();
}

export function getTwilioRealtimeWebSocketUrl() {
  return toWebSocketUrl(appConfig.url);
}

export function detectTwilioChannel(caller: string) {
  return caller.startsWith("whatsapp:") ? "whatsapp-voice" : "phone";
}

export function buildTwilioStreamResponse(context: TwilioInboundCallContext) {
  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect();
  const stream = connect.stream({
    url: getTwilioRealtimeWebSocketUrl(),
    name: `${context.tenantId}-${context.callSid}`,
  });

  stream.parameter({ name: "tenantId", value: context.tenantId });
  stream.parameter({ name: "caller", value: context.caller });
  stream.parameter({ name: "callSid", value: context.callSid });
  stream.parameter({ name: "channel", value: context.channel });

  return response.toString();
}

function shouldBypassSignatureValidation() {
  return appConfig.isInsecureTwilioSignatureAllowed || !env.TWILIO_AUTH_TOKEN;
}

export function validateTwilioHttpRequest(requestUrl: string, signature: string | null, params: Record<string, string>) {
  if (shouldBypassSignatureValidation()) {
    if (!signature) {
      logWarn("twilio.signature.skipped", {
        reason: "insecure_mode_or_missing_auth_token",
      });
    }

    return true;
  }

  if (!signature) {
    return false;
  }

  if (!env.TWILIO_AUTH_TOKEN) {
    return false;
  }

  return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, requestUrl, params);
}

export function validateTwilioWebSocketRequest(requestUrl: string, signature: string | undefined) {
  if (shouldBypassSignatureValidation()) {
    if (!signature) {
      logWarn("twilio.websocket_signature.skipped", {
        reason: "insecure_mode_or_missing_auth_token",
      });
    }

    return true;
  }

  if (!signature) {
    return false;
  }

  if (!env.TWILIO_AUTH_TOKEN) {
    return false;
  }

  return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, requestUrl, {});
}
