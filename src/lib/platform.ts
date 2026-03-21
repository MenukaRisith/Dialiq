import { listProviderCredentialsDashboard } from "@/lib/repositories/provider-credentials";
import {
  getAgentOperationalSnapshot,
  getAnalyticsOperationalSnapshot,
  getIntegrationOperationalSnapshot,
  getKnowledgeOperationalSnapshot,
  getTeamOperationalSnapshot,
  getWorkspaceOperationalSnapshot,
} from "@/lib/repositories/workspace-operations";
import {
  adminMetrics,
  auditEvents,
  featureFlags,
  tenantRecords,
} from "@/lib/mock-data";

export async function getWorkspaceSnapshot(tenantId?: string) {
  return getWorkspaceOperationalSnapshot(tenantId);
}

export async function getKnowledgeSnapshot(tenantId?: string) {
  return getKnowledgeOperationalSnapshot(tenantId);
}

export async function getIntegrationSnapshot(tenantId?: string) {
  return getIntegrationOperationalSnapshot(tenantId);
}

export async function getAgentSnapshot(tenantId?: string) {
  return getAgentOperationalSnapshot(tenantId);
}

export async function getAnalyticsSnapshot(tenantId?: string) {
  return getAnalyticsOperationalSnapshot(tenantId);
}

export async function getTeamSnapshot(tenantId?: string) {
  return getTeamOperationalSnapshot(tenantId);
}

export async function getAdminSnapshot() {
  const providerDashboard = await listProviderCredentialsDashboard();

  return {
    metrics: adminMetrics,
    providers: providerDashboard.credentials,
    database: providerDashboard.database,
    tenants: tenantRecords,
    audit: auditEvents,
    featureFlags,
  };
}
