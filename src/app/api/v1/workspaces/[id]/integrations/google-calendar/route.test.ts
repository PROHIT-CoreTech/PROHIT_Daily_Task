import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/calendar-bridge/google", () => ({
  getGoogleAuthUrl: vi.fn(() => "https://accounts.google.com/o/oauth2/mock-consent"),
  revokeConnection: vi.fn(async () => {}),
}));

import { auth } from "@/lib/auth";
import { revokeConnection } from "@/lib/calendar-bridge/google";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace } from "@/test/factories";
import { CalendarConnection } from "@/models/CalendarConnection";
import { GET, POST, DELETE } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function request(workspaceId: string, method = "GET") {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/integrations/google-calendar`, { method });
}

async function connectAsUser(workspaceId: string, userId: string) {
  return CalendarConnection.create({
    workspaceId,
    userId,
    provider: "google",
    googleCalendarId: "primary",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenExpiresAt: new Date(Date.now() + 3600_000),
    lastSyncedAt: new Date("2026-01-01T00:00:00Z"),
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

describe("GET /api/v1/workspaces/[id]/integrations/google-calendar", () => {
  it("reports not connected when there is no connection", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    const res = await GET(request(workspace._id.toString()), { params: Promise.resolve({ id: workspace._id.toString() }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
  });

  it("reports connection status without leaking tokens", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    await connectAsUser(workspace._id.toString(), owner._id.toString());
    loginAs(owner._id.toString());

    const res = await GET(request(workspace._id.toString()), { params: Promise.resolve({ id: workspace._id.toString() }) });
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.lastSyncedAt).toBeTruthy();
    expect(body).not.toHaveProperty("accessToken");
    expect(body).not.toHaveProperty("refreshToken");
  });

  it("rejects a non-member with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const stranger = await createUser();
    loginAs(stranger._id.toString());

    const res = await GET(request(workspace._id.toString()), { params: Promise.resolve({ id: workspace._id.toString() }) });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/workspaces/[id]/integrations/google-calendar", () => {
  it("returns 402 entitlement_required on the Free plan", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    loginAs(owner._id.toString());

    const res = await POST(request(workspace._id.toString(), "POST"), { params: Promise.resolve({ id: workspace._id.toString() }) });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("entitlement_required");
  });

  it("returns the consent url and sets a scoped CSRF cookie on Pro", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    const res = await POST(request(workspace._id.toString(), "POST"), { params: Promise.resolve({ id: workspace._id.toString() }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://accounts.google.com/o/oauth2/mock-consent");

    const cookie = res.cookies.get("gcal_oauth_state");
    expect(cookie).toBeDefined();
    expect(cookie!.path).toBe("/api/v1/integrations/google-calendar/callback");
  });
});

describe("DELETE /api/v1/workspaces/[id]/integrations/google-calendar", () => {
  it("returns 404 when there is nothing to disconnect", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    const res = await DELETE(request(workspace._id.toString(), "DELETE"), { params: Promise.resolve({ id: workspace._id.toString() }) });
    expect(res.status).toBe(404);
  });

  it("revokes and deletes the caller's connection", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    await connectAsUser(workspace._id.toString(), owner._id.toString());
    loginAs(owner._id.toString());

    const res = await DELETE(request(workspace._id.toString(), "DELETE"), { params: Promise.resolve({ id: workspace._id.toString() }) });
    expect(res.status).toBe(200);
    expect(revokeConnection).toHaveBeenCalledTimes(1);

    const remaining = await CalendarConnection.findOne({ workspaceId: workspace._id, userId: owner._id });
    expect(remaining).toBeNull();
  });

  it("does not disconnect another member's connection", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const other = await createUser();
    await connectAsUser(workspace._id.toString(), other._id.toString());
    loginAs(owner._id.toString());

    const res = await DELETE(request(workspace._id.toString(), "DELETE"), { params: Promise.resolve({ id: workspace._id.toString() }) });
    expect(res.status).toBe(404);

    const stillThere = await CalendarConnection.findOne({ workspaceId: workspace._id, userId: other._id });
    expect(stillThere).not.toBeNull();
  });
});
