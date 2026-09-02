import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/calendar-bridge/google", () => ({
  exchangeCodeForTokens: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/calendar-bridge/google";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace } from "@/test/factories";
import { CalendarConnection } from "@/models/CalendarConnection";
import { GET } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function callbackRequest(query: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000/api/v1/integrations/google-calendar/callback${query}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

beforeAll(async () => {
  await setupTestDb();
});
afterAll(async () => {
  await teardownTestDb();
});
beforeEach(async () => {
  await clearTestDb();
  vi.clearAllMocks();
});

describe("GET /api/v1/integrations/google-calendar/callback", () => {
  it("redirects with calendar_error=denied when Google reports an error", async () => {
    const res = await GET(callbackRequest("?error=access_denied"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/settings?calendar_error=denied");
  });

  it("redirects with calendar_error=invalid_request when code or state is missing", async () => {
    const res = await GET(callbackRequest(""));
    expect(res.headers.get("location")).toContain("calendar_error=invalid_request");
  });

  it("redirects with calendar_error=state_mismatch when the CSRF cookie doesn't match", async () => {
    const res = await GET(callbackRequest("?code=abc&state=someWorkspaceId.token1", "gcal_oauth_state=token2"));
    expect(res.headers.get("location")).toContain("calendar_error=state_mismatch");
  });

  it("redirects with calendar_error=state_mismatch when there is no cookie at all", async () => {
    const res = await GET(callbackRequest("?code=abc&state=someWorkspaceId.token1"));
    expect(res.headers.get("location")).toContain("calendar_error=state_mismatch");
  });

  it("exchanges the code, persists the connection, and redirects to calendar=connected", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    (exchangeCodeForTokens as Mock).mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const state = `${workspace._id.toString()}.csrf-token`;
    const res = await GET(callbackRequest(`?code=auth-code&state=${state}`, "gcal_oauth_state=csrf-token"));

    expect(res.headers.get("location")).toContain("/settings?calendar=connected");
    expect(exchangeCodeForTokens).toHaveBeenCalledWith("auth-code");

    const connection = await CalendarConnection.findOne({ workspaceId: workspace._id, userId: owner._id }).select(
      "+accessToken +refreshToken"
    );
    expect(connection).not.toBeNull();
    expect(connection!.accessToken).toBe("new-access");
    expect(connection!.refreshToken).toBe("new-refresh");
  });

  it("redirects with calendar_error=connect_failed on a Free plan (entitlement lost between click and callback)", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    loginAs(owner._id.toString());

    const state = `${workspace._id.toString()}.csrf-token`;
    const res = await GET(callbackRequest(`?code=auth-code&state=${state}`, "gcal_oauth_state=csrf-token"));

    expect(res.headers.get("location")).toContain("calendar_error=connect_failed");
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("redirects with calendar_error=connect_failed when the caller isn't a member of the stated workspace", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const stranger = await createUser();
    loginAs(stranger._id.toString());

    const state = `${workspace._id.toString()}.csrf-token`;
    const res = await GET(callbackRequest(`?code=auth-code&state=${state}`, "gcal_oauth_state=csrf-token"));

    expect(res.headers.get("location")).toContain("calendar_error=connect_failed");
  });
});
