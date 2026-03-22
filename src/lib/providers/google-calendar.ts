import { google } from "googleapis";

import { AppError } from "@/lib/api/route-handler";
import { appConfig, env } from "@/lib/config/env";
import { getGoogleCalendarConnectionByWorkspaceId, saveGoogleCalendarConnection } from "@/lib/repositories/calendar-connections";
import { resolveProviderConfigValue } from "@/lib/repositories/provider-credentials";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const GOOGLE_API_TIMEOUT_MS = Math.max(appConfig.providerConnectTimeoutMs, 2_500);

async function getGoogleOAuthConfig() {
  const clientId = await resolveProviderConfigValue("GOOGLE_CLIENT_ID");
  const clientSecret = await resolveProviderConfigValue("GOOGLE_CLIENT_SECRET");
  const redirectUri = await resolveProviderConfigValue("GOOGLE_REDIRECT_URI");

  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError("Google Calendar OAuth is not configured.", {
      statusCode: 500,
      code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    });
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

async function createGoogleOAuthClient() {
  const config = await getGoogleOAuthConfig();

  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
}

async function withGoogleTimeout<T>(operation: Promise<T>, operationName: string) {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new AppError(`${operationName} timed out.`, {
              statusCode: 504,
              code: "GOOGLE_CALENDAR_TIMEOUT",
            }),
          );
        }, GOOGLE_API_TIMEOUT_MS);
        timeoutHandle.unref?.();
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function createGoogleCalendarClient(workspaceId: string) {
  const connection = await getGoogleCalendarConnectionByWorkspaceId(workspaceId);

  if (!connection) {
    throw new AppError("Google Calendar is not connected for this workspace.", {
      statusCode: 503,
      code: "GOOGLE_CALENDAR_NOT_CONNECTED",
    });
  }

  const auth = await createGoogleOAuthClient();
  auth.setCredentials({
    refresh_token: connection.refreshToken,
  });

  return {
    connection,
    calendar: google.calendar({
      version: "v3",
      auth,
    }),
  };
}

export async function buildGoogleCalendarConnectUrl(workspaceSlug: string) {
  const auth = await createGoogleOAuthClient();

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
  const auth = await createGoogleOAuthClient();
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
    calendarId:
      (await resolveProviderConfigValue("GOOGLE_DEFAULT_CALENDAR_ID")) ??
      env.GOOGLE_DEFAULT_CALENDAR_ID ??
      "primary",
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
  const { connection, calendar } = await createGoogleCalendarClient(input.workspaceId);
  const event = await withGoogleTimeout(
    calendar.events.insert({
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
    }),
    "Google Calendar event creation",
  );

  if (!event.data.id) {
    throw new AppError("Google Calendar did not return an event ID.", {
      statusCode: 502,
      code: "GOOGLE_CALENDAR_EVENT_MISSING_ID",
    });
  }

  return event.data;
}

export interface CalendarSlotCandidate {
  label: string;
  start: Date;
  end: Date;
}

function overlaps(left: CalendarSlotCandidate, rightStart: Date, rightEnd: Date) {
  return left.start < rightEnd && left.end > rightStart;
}

export async function getGoogleCalendarAvailableSlots(input: {
  workspaceId: string;
  timezone: string;
  candidates: CalendarSlotCandidate[];
}) {
  if (input.candidates.length === 0) {
    return [];
  }

  const { connection, calendar } = await createGoogleCalendarClient(input.workspaceId);
  const timeMin = new Date(
    Math.min(...input.candidates.map((candidate) => candidate.start.getTime())),
  );
  const timeMax = new Date(
    Math.max(...input.candidates.map((candidate) => candidate.end.getTime())),
  );
  const freeBusy = await withGoogleTimeout(
    calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: input.timezone,
        items: [{ id: connection.calendarId || "primary" }],
      },
    }),
    "Google Calendar free/busy read",
  );
  const busyWindows =
    freeBusy.data.calendars?.[connection.calendarId || "primary"]?.busy ?? [];

  return input.candidates.filter((candidate) => {
    return !busyWindows.some((window) => {
      if (!window.start || !window.end) {
        return false;
      }

      return overlaps(candidate, new Date(window.start), new Date(window.end));
    });
  });
}
