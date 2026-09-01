import { google } from "googleapis";
import { CalendarConnection, type CalendarConnectionDoc } from "@/models/CalendarConnection";
import type { HydratedDocument } from "mongoose";

// Least-privilege scope: only this app's own events, not the user's whole
// calendar. `access_type: offline` + `prompt: consent` are both required to
// reliably get a refresh_token back — Google only returns one on the first
// consent, or when consent is forced again.
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function getOAuthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}

export function getGoogleAuthUrl(state: string): string {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Google did not return a full token set (missing refresh_token — was `prompt=consent` dropped?)");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date),
  };
}

/**
 * Builds an authorized client for one connection. googleapis refreshes the
 * access token automatically when it's expired; the `tokens` event fires
 * with the new one, which we persist back so the next call doesn't have to
 * refresh again.
 */
function getAuthorizedClient(connection: HydratedDocument<CalendarConnectionDoc>) {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.tokenExpiresAt.getTime(),
  });

  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    CalendarConnection.findByIdAndUpdate(connection._id, {
      accessToken: tokens.access_token,
      ...(tokens.expiry_date ? { tokenExpiresAt: new Date(tokens.expiry_date) } : {}),
    }).catch((err) => console.error("[calendar-bridge] failed to persist refreshed token", err));
  });

  return client;
}

export type CalendarTaskInput = {
  title: string;
  description?: string;
  dueDate: Date;
};

/** Creates or updates the Calendar event for a task. Returns the event id to store on the task. */
export async function upsertTaskEvent(
  connection: HydratedDocument<CalendarConnectionDoc>,
  task: CalendarTaskInput,
  existingEventId?: string
): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth: getAuthorizedClient(connection) });

  // Tasks don't have a duration — render as a 30-minute block on the due
  // date so it's visible in day/week grid views, not just all-day lists.
  const start = task.dueDate;
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const requestBody = {
    summary: task.title,
    description: task.description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    source: { title: "PROHIT Daily Task", url: process.env.NEXTAUTH_URL ?? "" },
  };

  if (existingEventId) {
    const res = await calendar.events.update({
      calendarId: connection.googleCalendarId,
      eventId: existingEventId,
      requestBody,
    });
    return res.data.id ?? existingEventId;
  }

  const res = await calendar.events.insert({
    calendarId: connection.googleCalendarId,
    requestBody,
  });
  if (!res.data.id) throw new Error("Google Calendar did not return an event id");
  return res.data.id;
}

export async function deleteTaskEvent(connection: HydratedDocument<CalendarConnectionDoc>, eventId: string): Promise<void> {
  const calendar = google.calendar({ version: "v3", auth: getAuthorizedClient(connection) });
  try {
    await calendar.events.delete({ calendarId: connection.googleCalendarId, eventId });
  } catch (err: unknown) {
    // Already deleted on the Google side (e.g. user removed it manually) — not an error for us.
    const status = (err as { code?: number })?.code;
    if (status !== 404 && status !== 410) throw err;
  }
}

export async function revokeConnection(connection: HydratedDocument<CalendarConnectionDoc>): Promise<void> {
  const client = getAuthorizedClient(connection);
  await client.revokeCredentials().catch((err) => console.error("[calendar-bridge] revoke failed (continuing)", err));
}
