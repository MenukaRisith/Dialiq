import {
  AppError,
  createRouteHandler,
  jsonSuccess,
  parseJsonBody,
} from "@/lib/api/route-handler";
import {
  appConfig,
  missingCoreProviders,
  providerReadiness,
} from "@/lib/config/env";
import { simulateInboundVoiceCall, voiceWebhookSchema } from "@/lib/voice/pipeline";

export const GET = createRouteHandler(
  "/api/webhooks/twilio/voice",
  async (_request, context) =>
    jsonSuccess(context, {
      route: "/api/webhooks/twilio/voice",
      method: "POST",
      mode: appConfig.isMockMode ? "mock" : "live",
      description:
        "Inbound voice webhook contract for Dialiq. Payloads are validated before the trusted voice-agent pipeline runs.",
      providers: providerReadiness,
    }),
);

export const POST = createRouteHandler(
  "/api/webhooks/twilio/voice",
  async (request, context) => {
    const payload = await parseJsonBody(request, voiceWebhookSchema);

    if (!appConfig.isMockMode && missingCoreProviders.length > 0) {
      throw new AppError("Core provider configuration is incomplete.", {
        statusCode: 503,
        code: "PROVIDER_CONFIGURATION_INCOMPLETE",
        details: missingCoreProviders.map((provider) => ({
          provider: provider.label,
          requiredEnv: provider.requiredEnv,
        })),
      });
    }

    const result = await simulateInboundVoiceCall(payload);

    return jsonSuccess(context, {
      mode: appConfig.isMockMode ? "mock" : "live-ready",
      providerHealth: providerReadiness,
      result,
    });
  },
);
