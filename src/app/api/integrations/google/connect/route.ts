import { AppError, createRouteHandler } from "@/lib/api/route-handler";
import { buildGoogleCalendarConnectUrl } from "@/lib/providers/google-calendar";
import { DEFAULT_TENANT_ID } from "@/lib/repositories/workspace-operations";

export const GET = createRouteHandler(
  "/api/integrations/google/connect",
  async (request) => {
    const workspaceSlug =
      new URL(request.url).searchParams.get("workspaceId") ?? DEFAULT_TENANT_ID;

    if (!workspaceSlug) {
      throw new AppError("workspaceId is required.", {
        statusCode: 400,
        code: "WORKSPACE_ID_REQUIRED",
      });
    }

    return Response.redirect(await buildGoogleCalendarConnectUrl(workspaceSlug), 302);
  },
);
