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
  providerCredentials,
  recentCalls,
  serviceCatalog,
  teamMembers,
  tenantRecords,
  voicePipeline,
  weeklyVolume,
  workspaceProfile,
} from "@/lib/mock-data";

export async function getWorkspaceSnapshot() {
  return {
    profile: workspaceProfile,
    metrics: dashboardMetrics,
    onboarding: onboardingChecklist,
    pipeline: voicePipeline,
    calls: recentCalls,
    leads: leadCaptures,
    bookings,
  };
}

export async function getKnowledgeSnapshot() {
  return {
    sources: knowledgeSources,
    products: productCatalog,
    services: serviceCatalog,
  };
}

export async function getIntegrationSnapshot() {
  return {
    integrations,
    bookingTypes,
  };
}

export async function getAgentSnapshot() {
  return {
    profile: workspaceProfile,
    rules: agentRules,
    pipeline: voicePipeline,
  };
}

export async function getAnalyticsSnapshot() {
  return {
    metrics: dashboardMetrics,
    intentMix: analyticsBreakdown,
    weeklyVolume,
  };
}

export async function getTeamSnapshot() {
  return {
    members: teamMembers,
    leads: leadCaptures,
  };
}

export async function getAdminSnapshot() {
  return {
    metrics: adminMetrics,
    providers: providerCredentials,
    tenants: tenantRecords,
    audit: auditEvents,
    featureFlags,
  };
}
