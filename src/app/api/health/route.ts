import {
  createRouteHandler,
  jsonSuccess,
} from "@/lib/api/route-handler";
import {
  appConfig,
  missingCoreProviders,
  providerReadiness,
} from "@/lib/config/env";

export const GET = createRouteHandler("/api/health", async (_request, context) =>
  jsonSuccess(context, {
    service: appConfig.name,
    environment: appConfig.environment,
    mockMode: appConfig.isMockMode,
    status: missingCoreProviders.length === 0 ? "ok" : "degraded",
    providers: providerReadiness,
  }),
);
