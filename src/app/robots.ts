import type { MetadataRoute } from "next";

import { appConfig } from "@/lib/config/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${appConfig.url.toString().replace(/\/$/, "")}/sitemap.xml`,
  };
}
