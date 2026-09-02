import { NextRequest, NextResponse } from "next/server";
import { withWorkspace, requireFeature } from "@/lib/api/middleware";
import { getEntitlements } from "@/lib/entitlements/service";
import { exchangeCodeForTokens } from "@/lib/calendar-bridge/google";
import { CalendarConnection } from "@/models/CalendarConnection";

const STATE_COOKIE = "gcal_oauth_state";

/**
 * Google redirects here after consent (GOOGLE_REDIRECT_URI). Not nested
 * under /workspaces/[id] — Google only round-trips whatever we put in
 * `state`, not our path params — so the workspace id travels in `state`
 * instead and every check below is done by hand rather than via a
 * [id]-scoped route.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  function redirect(query: string) {
    const res = NextResponse.redirect(new URL(`/settings${query}`, req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (url.searchParams.get("error")) return redirect("?calendar_error=denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return redirect("?calendar_error=invalid_request");

  const [workspaceId, csrfToken] = state.split(".");
  const cookieToken = req.cookies.get(STATE_COOKIE)?.value;
  if (!workspaceId || !csrfToken || !cookieToken || cookieToken !== csrfToken) {
    return redirect("?calendar_error=state_mismatch");
  }

  try {
    const { userId } = await withWorkspace(workspaceId);
    const entitlements = await getEntitlements(workspaceId);
    requireFeature(entitlements, "calendar_bridge");

    const tokens = await exchangeCodeForTokens(code);

    await CalendarConnection.findOneAndUpdate(
      { workspaceId, userId, provider: "google" },
      {
        $set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          connectedAt: new Date(),
        },
        $unset: { lastSyncError: 1 },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return redirect("?calendar=connected");
  } catch (err) {
    console.error("[calendar-bridge] OAuth callback failed", err);
    return redirect("?calendar_error=connect_failed");
  }
}
