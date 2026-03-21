import {
  createRouteHandler,
  jsonSuccess,
} from "@/lib/api/route-handler";
import { getWorkspaceSnapshot } from "@/lib/platform";

export const GET = createRouteHandler(
  "/api/platform/workspace",
  async (_request, context) => {
    const snapshot = await getWorkspaceSnapshot();
    return jsonSuccess(context, snapshot);
  },
);
