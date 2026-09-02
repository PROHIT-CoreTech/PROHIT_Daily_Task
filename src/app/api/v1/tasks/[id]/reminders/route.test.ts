import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, createList, createTask } from "@/test/factories";
import { Task } from "@/models/Task";
import { POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(taskId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}/reminders`, {
    method: "POST",
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

describe("POST /api/v1/tasks/[id]/reminders", () => {
  it("creates a reminder", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    const res = await POST(postRequest(task._id.toString(), { remindAt: new Date(Date.now() + 3_600_000).toISOString() }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(201);

    const updated = await Task.findById(task._id).lean();
    expect(updated!.reminders).toHaveLength(1);
  });

  it("rejects a 2nd reminder on the Free plan (maxRemindersPerTask = 1) with 402 limit_exceeded", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    await POST(postRequest(task._id.toString(), { remindAt: new Date(Date.now() + 3_600_000).toISOString() }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    const res = await POST(postRequest(task._id.toString(), { remindAt: new Date(Date.now() + 7_200_000).toISOString() }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("limit_exceeded");
    expect(body.limit).toBe("maxRemindersPerTask");
  });
});
