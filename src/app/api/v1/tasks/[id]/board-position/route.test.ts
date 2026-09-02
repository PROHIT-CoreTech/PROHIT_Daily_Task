import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, createList, createTask } from "@/test/factories";
import { Task } from "@/models/Task";
import { PATCH } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function patchRequest(taskId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}/board-position`, {
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

describe("PATCH /api/v1/tasks/[id]/board-position", () => {
  it("rejects on the Free plan (flow_board off) with 402", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    const res = await PATCH(patchRequest(task._id.toString(), { boardColumnId: "in_progress" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(402);
  });

  it("moves into a non-done column, setting boardColumnId/status, with default ordering when no neighbours given", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    const res = await PATCH(patchRequest(task._id.toString(), { boardColumnId: "in_progress" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(200);

    const updated = await Task.findById(task._id).lean();
    expect(updated!.boardColumnId).toBe("in_progress");
    expect(updated!.status).toBe("in_progress");
    expect(updated!.boardOrder).toBe(1000);
  });

  it("moving into done triggers the shared completeTask path (completedAt + status)", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    const res = await PATCH(patchRequest(task._id.toString(), { boardColumnId: "done" }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(200);

    const updated = await Task.findById(task._id).lean();
    expect(updated!.status).toBe("done");
    expect(updated!.boardColumnId).toBe("done");
    expect(updated!.completedAt).toBeDefined();
  });

  it("wires beforeTaskId/afterTaskId through to computeBoardOrder (midpoint of two neighbours)", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);

    const lower = await Task.create({
      workspaceId: workspace._id,
      listId: list._id,
      title: "Lower",
      boardColumnId: "todo",
      boardOrder: 1000,
      createdBy: owner._id,
    });
    const upper = await Task.create({
      workspaceId: workspace._id,
      listId: list._id,
      title: "Upper",
      boardColumnId: "todo",
      boardOrder: 2000,
      createdBy: owner._id,
    });
    loginAs(owner._id.toString());

    const res = await PATCH(
      patchRequest(task._id.toString(), {
        boardColumnId: "todo",
        afterTaskId: lower._id.toString(),
        beforeTaskId: upper._id.toString(),
      }),
      { params: Promise.resolve({ id: task._id.toString() }) }
    );
    expect(res.status).toBe(200);

    const updated = await Task.findById(task._id).lean();
    expect(updated!.boardOrder).toBe(1500);
  });
});
