import {
  createRouteHandler,
  jsonSuccess,
} from "@/lib/api/route-handler";
import { requireAuthenticatedAdminApi } from "@/lib/auth/admin-session";
import { getAdminSnapshot } from "@/lib/platform";

export const GET = createRouteHandler(
  "/api/platform/admin",
  async (_request, context) => {
    await requireAuthenticatedAdminApi();
    const snapshot = await getAdminSnapshot();
    return jsonSuccess(context, snapshot);
  },
);
