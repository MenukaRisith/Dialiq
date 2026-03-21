import {
  AppError,
  createRouteHandler,
  jsonSuccess,
  parseJsonBody,
} from "@/lib/api/route-handler";
import { appConfig } from "@/lib/config/env";
import {
  buildTwilioStreamResponse,
  detectTwilioChannel,
  validateTwilioHttpRequest,
} from "@/lib/providers/twilio";
import { getOperationalReadiness } from "@/lib/repositories/provider-credentials";
import { DEFAULT_TENANT_ID } from "@/lib/repositories/workspace-operations";
import { simulateInboundVoiceCall, voiceWebhookSchema } from "@/lib/voice/pipeline";

const coreProviderKeys = new Set(["twilio", "deepgram", "openrouter", "elevenlabs"]);

function toObject(formData: FormData) {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

function buildXmlResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export const GET = createRouteHandler(
  "/api/webhooks/twilio/voice",
  async (_request, context) => {
    const operational = await getOperationalReadiness();

    return jsonSuccess(context, {
      route: "/api/webhooks/twilio/voice",
      method: "POST",
      mode: appConfig.isMockMode ? "mock" : "live",
      description:
        "Inbound voice webhook for Twilio. JSON requests simulate transcript turns, while Twilio form posts receive TwiML that opens the realtime media stream.",
      realtimeWebSocketPath: "/realtime/twilio",
      database: operational.database,
      providers: operational.providers,
    });
  },
);

export const POST = createRouteHandler(
  "/api/webhooks/twilio/voice",
  async (request, context) => {
    const contentType = request.headers.get("content-type") ?? "";
    const operational = await getOperationalReadiness();
    const missingCoreProviders = operational.providers.filter(
      (provider) => coreProviderKeys.has(provider.key) && !provider.configured,
    );

    if (contentType.includes("application/json")) {
      const payload = await parseJsonBody(request, voiceWebhookSchema);

      if (!appConfig.isMockMode && missingCoreProviders.length > 0) {
        throw new AppError("Core provider configuration is incomplete.", {
          statusCode: 503,
          code: "PROVIDER_CONFIGURATION_INCOMPLETE",
          details: missingCoreProviders.map((provider) => ({
            provider: provider.label,
            requiredEnv: provider.requiredEnv,
            source: provider.source,
          })),
        });
      }

      const result = await simulateInboundVoiceCall(payload);

      return jsonSuccess(context, {
        mode: appConfig.isMockMode ? "mock" : "live-ready",
        database: operational.database,
        providerHealth: operational.providers,
        result,
      });
    }

    const formData = await request.formData();
    const params = toObject(formData);
    const signature = request.headers.get("x-twilio-signature");

    if (!validateTwilioHttpRequest(request.url, signature, params)) {
      throw new AppError("Twilio signature validation failed.", {
        statusCode: 401,
        code: "TWILIO_SIGNATURE_INVALID",
      });
    }

    if (!appConfig.isMockMode && missingCoreProviders.length > 0) {
      return buildXmlResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Dialiq is temporarily unavailable. Please try again later.</Say></Response>`,
      );
    }

    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;
    const caller = params.From ?? "Unknown caller";
    const callSid = params.CallSid ?? context.requestId;
    const channel = detectTwilioChannel(caller);

    return buildXmlResponse(
      buildTwilioStreamResponse({
        tenantId,
        caller,
        callSid,
        channel,
      }),
    );
  },
);
