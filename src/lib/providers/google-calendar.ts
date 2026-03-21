import { google } from "googleapis";

import { AppError } from "@/lib/api/route-handler";
import { env } from "@/lib/config/env";
import { getGoogleCalendarConnectionByWorkspaceId, saveGoogleCalendarConnection } from "@/lib/repositories/calendar-connections";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function ensureGoogleOAuthConfigured() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new AppError("Google Calendar OAuth is not configured.", {
      statusCode: 500,
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    });
  }
}

function createGoogleOAuthClient() {
  ensureGoogleOAuthConfigured();

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function buildGoogleCalendarConnectUrl(workspaceSlug: string) {
  const auth = createGoogleOAuthClient();

  return auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_CALENDAR_SCOPE],
    state: workspaceSlug,
  });
}

export async function exchangeGoogleCalendarCode(input: {
  workspaceSlug: string;
  code: string;
}) {
  const auth = createGoogleOAuthClient();
  const tokenResponse = await auth.getToken(input.code);
  const refreshToken = tokenResponse.tokens.refresh_token;

  if (!refreshToken) {
    throw new AppError(
      "Google did not return a refresh token. Reconnect with consent to continue.",
      {
        statusCode: 400,
        code: "GOOGLE_REFRESH_TOKEN_MISSING",
      },
    );
  }

  auth.setCredentials(tokenResponse.tokens);
  const oauth2 = google.oauth2({
    version: "v2",
    auth,
  });
  const userInfo = await oauth2.userinfo.get();

  await saveGoogleCalendarConnection({
    workspaceSlug: input.workspaceSlug,
    refreshToken,
    accountEmail: userInfo.data.email ?? null,
    calendarId: env.GOOGLE_DEFAULT_CALENDAR_ID ?? "primary",
    scope: tokenResponse.tokens.scope?.split(" ") ?? [GOOGLE_CALENDAR_SCOPE],
  });
}

export async function createGoogleCalendarEvent(input: {
  workspaceId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timezone: string;
  attendeeEmail?: string;
}) {
  ensureGoogleOAuthConfigured();
  const connection = await getGoogleCalendarConnectionByWorkspaceId(input.workspaceId);

  if (!connection) {
    throw new AppError("Google Calendar is not connected for this workspace.", {
      statusCode: 503,
      code: "GOOGLE_CALENDAR_NOT_CONNECTED",
    });
  }

  const auth = createGoogleOAuthClient();
  auth.setCredentials({
    refresh_token: connection.refreshToken,
  });

  const calendar = google.calendar({
    version: "v3",
    auth,
  });

  const event = await calendar.events.insert({
    calendarId: connection.calendarId || "primary",
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.start.toISOString(),
        timeZone: input.timezone,
      },
      end: {
        dateTime: input.end.toISOString(),
        timeZone: input.timezone,
      },
      attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
    },
  });

  if (!event.data.id) {
    throw new AppError("Google Calendar did not return an event ID.", {
      statusCode: 502,
      code: "GOOGLE_CALENDAR_EVENT_MISSING_ID",
    });
  }

  return event.data;
}
