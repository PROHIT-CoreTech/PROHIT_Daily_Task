import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { Types } from "mongoose";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, createList, createTask } from "@/test/factories";
import { Task } from "@/models/Task";
import { PATCH, DELETE } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function patchRequest(taskId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}/subtasks/x`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(taskId: string) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}/subtasks/x`, { method: "DELETE" });
}

async function seedTaskWithSubtask(owner: Awaited<ReturnType<typeof createUser>>) {
  const workspace = await createWorkspace(owner, { plan: "pro" });
  const list = await createList(workspace._id, owner);
  const task = await createTask(workspace._id, list._id, owner);
  task.subtasks.push({ title: "Do the thing", done: false, order: 0 });
  await task.save();
  return { workspace, task, subtaskId: task.subtasks[0]._id!.toString() };
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

describe("PATCH /api/v1/tasks/[id]/subtasks/[sid]", () => {
  it("toggles done and updates title/order", async () => {
    const owner = await createUser();
    const { task, subtaskId } = await seedTaskWithSubtask(owner);
    loginAs(owner._id.toString());

    const res = await PATCH(patchRequest(task._id.toString(), { done: true, title: "Renamed", order: 2 }), {
      params: Promise.resolve({ id: task._id.toString(), sid: subtaskId }),
    });
    expect(res.status).toBe(200);

    const updated = await Task.findById(task._id).lean();
    const subtask = updated!.subtasks.find((s) => s._id!.toString() === subtaskId);
    expect(subtask!.done).toBe(true);
    expect(subtask!.title).toBe("Renamed");
    expect(subtask!.order).toBe(2);
  });

  it("returns 404 for an unknown subtask id", async () => {
    const owner = await createUser();
    const { task } = await seedTaskWithSubtask(owner);
    loginAs(owner._id.toString());

    const res = await PATCH(patchRequest(task._id.toString(), { done: true }), {
      params: Promise.resolve({ id: task._id.toString(), sid: new Types.ObjectId().toString() }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/tasks/[id]/subtasks/[sid]", () => {
  it("removes the subtask", async () => {
    const owner = await createUser();
    const { task, subtaskId } = await seedTaskWithSubtask(owner);
    loginAs(owner._id.toString());

    const res = await DELETE(deleteRequest(task._id.toString()), {
      params: Promise.resolve({ id: task._id.toString(), sid: subtaskId }),
    });
    expect(res.status).toBe(200);

    const updated = await Task.findById(task._id).lean();
    expect(updated!.subtasks).toHaveLength(0);
  });

  it("returns 404 for an unknown subtask id", async () => {
    const owner = await createUser();
    const { task } = await seedTaskWithSubtask(owner);
    loginAs(owner._id.toString());

    const res = await DELETE(deleteRequest(task._id.toString()), {
      params: Promise.resolve({ id: task._id.toString(), sid: new Types.ObjectId().toString() }),
    });
    expect(res.status).toBe(404);
  });
});
