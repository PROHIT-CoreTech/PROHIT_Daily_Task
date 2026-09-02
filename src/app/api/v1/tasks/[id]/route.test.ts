import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace } from "@/test/factories";
import { List } from "@/models/List";
import { Task } from "@/models/Task";
import { GET, PATCH, DELETE } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function getRequest(taskId: string) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}`);
}

function patchRequest(taskId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedTask(owner: { _id: Types.ObjectId }, workspaceId: Types.ObjectId) {
  const list = await List.create({
    workspaceId,
    name: "Inbox",
    color: "#000000",
    order: 0,
    createdBy: owner._id,
  });
  return Task.create({
    workspaceId,
    listId: list._id,
    title: "Original title",
    createdBy: owner._id,
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

describe("GET /api/v1/tasks/[id]", () => {
  it("returns the task for a workspace member", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const task = await seedTask(owner, workspace._id);
    loginAs(owner._id.toString());

    const res = await GET(getRequest(task._id.toString()), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task.title).toBe("Original title");
  });

  it("rejects a user from a different workspace with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const task = await seedTask(owner, workspace._id);
    const outsider = await createUser();
    loginAs(outsider._id.toString());

    const res = await GET(getRequest(task._id.toString()), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for a missing task id", async () => {
    const owner = await createUser();
    loginAs(owner._id.toString());

    const res = await GET(getRequest(new Types.ObjectId().toString()), {
      params: Promise.resolve({ id: new Types.ObjectId().toString() }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/tasks/[id]", () => {
  it("updates title, status, and priority and persists them", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const task = await seedTask(owner, workspace._id);
    loginAs(owner._id.toString());

    const res = await PATCH(patchRequest(task._id.toString(), { title: "Updated", status: "in_progress", priority: 2 }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(200);

    const updated = await Task.findById(task._id).lean();
    expect(updated!.title).toBe("Updated");
    expect(updated!.status).toBe("in_progress");
    expect(updated!.priority).toBe(2);
  });
});

describe("DELETE /api/v1/tasks/[id]", () => {
  it("removes the task, subsequent GET returns 404", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const task = await seedTask(owner, workspace._id);
    loginAs(owner._id.toString());

    const del = await DELETE(getRequest(task._id.toString()), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(del.status).toBe(200);

    const res = await GET(getRequest(task._id.toString()), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(404);
  });
});
