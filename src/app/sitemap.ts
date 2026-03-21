import type { MetadataRoute } from "next";

import { appConfig } from "@/lib/config/env";

const routes = [
  "",
  "/workspace",
  "/workspace/calls",
  "/workspace/knowledge",
  "/workspace/integrations",
  "/workspace/agent",
  "/workspace/calendar",
  "/workspace/analytics",
  "/workspace/team",
  "/admin",
  "/admin/providers",
  "/admin/tenants",
  "/admin/logs",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: new URL(route || "/", appConfig.url).toString(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
