import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, createList, createTask } from "@/test/factories";
import { GET, POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(taskId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(taskId: string) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}/comments`);
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

describe("POST /api/v1/tasks/[id]/comments", () => {
  it("creates a comment", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    const res = await POST(postRequest(task._id.toString(), { body: "Looks good" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(201);
  });

  it("rejects a non-member of the task's workspace with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    const outsider = await createUser();
    loginAs(outsider._id.toString());

    const res = await POST(postRequest(task._id.toString(), { body: "Hi" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/tasks/[id]/comments", () => {
  it("returns comments sorted by createdAt ascending", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    await POST(postRequest(task._id.toString(), { body: "First" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    await POST(postRequest(task._id.toString(), { body: "Second" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });

    const res = await GET(getRequest(task._id.toString()), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    const body = await res.json();
    expect(body.comments.map((c: { body: string }) => c.body)).toEqual(["First", "Second"]);
  });
});
