import {
  createRouteHandler,
  jsonSuccess,
} from "@/lib/api/route-handler";
import { getAdminSnapshot } from "@/lib/platform";

export const GET = createRouteHandler(
  "/api/platform/admin",
  async (_request, context) => {
    const snapshot = await getAdminSnapshot();
    return jsonSuccess(context, snapshot);
  },
);
