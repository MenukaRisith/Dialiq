import { AppError, createRouteHandler } from "@/lib/api/route-handler";
import { exchangeGoogleCalendarCode } from "@/lib/providers/google-calendar";

export const GET = createRouteHandler(
  "/api/integrations/google/callback",
  async (request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      throw new AppError("Google callback is missing code or state.", {
        statusCode: 400,
        code: "GOOGLE_CALLBACK_INVALID",
      });
    }

    await exchangeGoogleCalendarCode({
      workspaceSlug: state,
      code,
    });

    const redirectTarget = new URL("/workspace/integrations?google=connected", request.url);
    return Response.redirect(redirectTarget, 302);
  },
);
