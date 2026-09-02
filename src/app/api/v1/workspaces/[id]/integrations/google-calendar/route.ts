import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withWorkspace, withEntitlements, withErrorHandling, requireFeature, ApiError } from "@/lib/api/middleware";
import { getGoogleAuthUrl, revokeConnection } from "@/lib/calendar-bridge/google";
import { CalendarConnection } from "@/models/CalendarConnection";

// Path-scoped so the browser only sends it back to the callback request,
// not on every request to the app.
const STATE_COOKIE = "gcal_oauth_state";
const CALLBACK_PATH = "/api/v1/integrations/google-calendar/callback";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { userId } = await withWorkspace(id);

    const connection = await CalendarConnection.findOne({ workspaceId: id, userId, provider: "google" }).lean();

    return NextResponse.json({
      connected: Boolean(connection),
      connectedAt: connection?.connectedAt ?? null,
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      lastSyncError: connection?.lastSyncError ?? null,
    });
  });
}

/** Starts the OAuth flow: returns the Google consent URL for the client to redirect to. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements } = await withEntitlements(id);
    requireFeature(entitlements, "calendar_bridge");

    // `state` round-trips the workspace id through Google plus a CSRF
    // token we verify against this cookie when the callback lands.
    const csrfToken = randomUUID();
    const url = getGoogleAuthUrl(`${id}.${csrfToken}`);

    const res = NextResponse.json({ url });
    res.cookies.set(STATE_COOKIE, csrfToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: CALLBACK_PATH,
    });
    return res;
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { userId } = await withWorkspace(id);

    const connection = await CalendarConnection.findOne({ workspaceId: id, userId, provider: "google" }).select(
      "+accessToken +refreshToken"
    );
    if (!connection) throw new ApiError(404, { error: "not_found", message: "No calendar connection to disconnect." });

    await revokeConnection(connection);
    await connection.deleteOne();

    return NextResponse.json({ ok: true });
  });
}
