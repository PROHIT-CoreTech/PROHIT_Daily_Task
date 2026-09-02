import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, addMember } from "@/test/factories";
import { FocusSession } from "@/models/FocusSession";
import { PATCH } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function patchRequest(sessionId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/focus-sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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

describe("PATCH /api/v1/focus-sessions/[id]", () => {
  it("ends the session, setting completed and endedAt", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const session = await FocusSession.create({
      workspaceId: workspace._id,
      userId: owner._id,
      plannedMinutes: 25,
      startedAt: new Date(),
    });
    loginAs(owner._id.toString());

    const res = await PATCH(patchRequest(session._id.toString(), { completed: true }), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(200);

    const updated = await FocusSession.findById(session._id).lean();
    expect(updated!.completed).toBe(true);
    expect(updated!.endedAt).toBeDefined();
  });

  it("rejects a different member of the same workspace ending someone else's session", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "team" });
    const teammate = await createUser();
    await addMember(workspace, teammate, "member");
    const session = await FocusSession.create({
      workspaceId: workspace._id,
      userId: owner._id,
      plannedMinutes: 25,
      startedAt: new Date(),
    });
    loginAs(teammate._id.toString());

    const res = await PATCH(patchRequest(session._id.toString(), { completed: true }), {
      params: Promise.resolve({ id: session._id.toString() }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown session id", async () => {
    const owner = await createUser();
    loginAs(owner._id.toString());

    const res = await PATCH(patchRequest(new Types.ObjectId().toString(), { completed: true }), {
      params: Promise.resolve({ id: new Types.ObjectId().toString() }),
    });
    expect(res.status).toBe(404);
  });
});
