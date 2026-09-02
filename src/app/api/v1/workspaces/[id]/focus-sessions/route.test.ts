import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace } from "@/test/factories";
import { FocusSession } from "@/models/FocusSession";
import { GET, POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(workspaceId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/focus-sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(workspaceId: string) {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/focus-sessions`);
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

describe("POST /api/v1/workspaces/[id]/focus-sessions", () => {
  it("starts a session", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { plannedMinutes: 25 }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(201);
  });

  it("rejects on the Free plan (deep_work off) with 402", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { plannedMinutes: 25 }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(402);
  });
});

describe("GET /api/v1/workspaces/[id]/focus-sessions", () => {
  it("counts only today's completed sessions in sessionsToday, and returns recent sessions", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await FocusSession.insertMany([
      { workspaceId: workspace._id, userId: owner._id, plannedMinutes: 25, startedAt: new Date(), completed: true },
      { workspaceId: workspace._id, userId: owner._id, plannedMinutes: 25, startedAt: new Date(), completed: false },
      { workspaceId: workspace._id, userId: owner._id, plannedMinutes: 25, startedAt: yesterday, completed: true },
    ]);

    const res = await GET(getRequest(workspace._id.toString()), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    const body = await res.json();
    expect(body.sessionsToday).toBe(1);
    expect(body.recent).toHaveLength(3);
  });
});
