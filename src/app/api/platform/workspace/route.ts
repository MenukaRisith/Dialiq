import {
  createRouteHandler,
  jsonSuccess,
} from "@/lib/api/route-handler";
import { getWorkspaceSnapshot } from "@/lib/platform";

export const GET = createRouteHandler(
  "/api/platform/workspace",
  async (request, context) => {
    const tenantId = new URL(request.url).searchParams.get("tenantId") ?? undefined;
    const snapshot = await getWorkspaceSnapshot(tenantId);
    return jsonSuccess(context, snapshot);
  },
);
