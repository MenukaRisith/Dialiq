import { cache } from "react";

import {
  adminMetrics,
  agentRules,
  analyticsBreakdown,
  auditEvents,
  bookings,
  bookingTypes,
  dashboardMetrics,
  featureFlags,
  integrations,
  knowledgeSources,
  leadCaptures,
  onboardingChecklist,
  productCatalog,
  recentCalls,
  serviceCatalog,
  teamMembers,
  tenantRecords,
  voicePipeline,
  weeklyVolume,
  workspaceProfile,
} from "@/lib/mock-data";
import { listProviderCredentialsDashboard } from "@/lib/repositories/provider-credentials";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const getWorkspaceSnapshot = cache(async () =>
  clone({
    profile: workspaceProfile,
    metrics: dashboardMetrics,
    onboarding: onboardingChecklist,
    pipeline: voicePipeline,
    calls: recentCalls,
    leads: leadCaptures,
    bookings,
  }),
);

export const getKnowledgeSnapshot = cache(async () =>
  clone({
    sources: knowledgeSources,
    products: productCatalog,
    services: serviceCatalog,
  }),
);

export const getIntegrationSnapshot = cache(async () =>
  clone({
    integrations,
    bookingTypes,
  }),
);

export const getAgentSnapshot = cache(async () =>
  clone({
    profile: workspaceProfile,
    rules: agentRules,
    pipeline: voicePipeline,
  }),
);

export const getAnalyticsSnapshot = cache(async () =>
  clone({
    metrics: dashboardMetrics,
    intentMix: analyticsBreakdown,
    weeklyVolume,
  }),
);

export const getTeamSnapshot = cache(async () =>
  clone({
    members: teamMembers,
    leads: leadCaptures,
  }),
);

export const getAdminSnapshot = cache(async () => {
  const providerDashboard = await listProviderCredentialsDashboard();

  return clone({
    metrics: adminMetrics,
    providers: providerDashboard.credentials,
    database: providerDashboard.database,
    tenants: tenantRecords,
    audit: auditEvents,
    featureFlags,
  });
});
