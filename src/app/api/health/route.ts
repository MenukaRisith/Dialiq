import {
  createRouteHandler,
  jsonSuccess,
} from "@/lib/api/route-handler";
import { appConfig } from "@/lib/config/env";
import { getOperationalReadiness } from "@/lib/repositories/provider-credentials";

const coreProviderKeys = new Set(["twilio", "deepgram", "openrouter", "elevenlabs"]);

export const GET = createRouteHandler("/api/health", async (_request, context) => {
  const operational = await getOperationalReadiness();
  const missingCoreProviders = operational.providers.filter(
    (provider) => coreProviderKeys.has(provider.key) && !provider.configured,
  );

  return jsonSuccess(context, {
    service: appConfig.name,
    environment: appConfig.environment,
    mockMode: appConfig.isMockMode,
    status:
      missingCoreProviders.length === 0 &&
      (!operational.database.configured || operational.database.reachable)
        ? "ok"
        : "degraded",
    database: operational.database,
    providers: operational.providers,
    liveReady: missingCoreProviders.length === 0,
  });
});
