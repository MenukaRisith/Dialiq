import {
  AppError,
  createRouteHandler,
  jsonSuccess,
  parseJsonBody,
} from "@/lib/api/route-handler";
import { appConfig } from "@/lib/config/env";
import { getOperationalReadiness } from "@/lib/repositories/provider-credentials";
import { simulateInboundVoiceCall, voiceWebhookSchema } from "@/lib/voice/pipeline";

const coreProviderKeys = new Set(["twilio", "deepgram", "openrouter", "elevenlabs"]);

export const GET = createRouteHandler(
  "/api/webhooks/twilio/voice",
  async (_request, context) => {
    const operational = await getOperationalReadiness();

    return jsonSuccess(context, {
      route: "/api/webhooks/twilio/voice",
      method: "POST",
      mode: appConfig.isMockMode ? "mock" : "live",
      description:
        "Inbound voice webhook contract for Dialiq. Payloads are validated before the trusted voice-agent pipeline runs.",
      database: operational.database,
      providers: operational.providers,
    });
  },
);

export const POST = createRouteHandler(
  "/api/webhooks/twilio/voice",
  async (request, context) => {
    const payload = await parseJsonBody(request, voiceWebhookSchema);
    const operational = await getOperationalReadiness();
    const missingCoreProviders = operational.providers.filter(
      (provider) => coreProviderKeys.has(provider.key) && !provider.configured,
    );

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
  },
);
