import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace } from "@/test/factories";
import { List } from "@/models/List";
import { Task } from "@/models/Task";
import { GET, POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(workspaceId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(workspaceId: string, query = "") {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/tasks${query}`);
}

async function seedList(workspaceId: string, owner: { _id: import("mongoose").Types.ObjectId }) {
  const list = await List.create({
    workspaceId,
    name: "Inbox",
    color: "#000000",
    order: 0,
    createdBy: owner._id,
  });
  return list;
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

describe("POST /api/v1/workspaces/[id]/tasks", () => {
  it("creates a task under a list", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await seedList(workspace._id.toString(), owner);
    loginAs(owner._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { listId: list._id.toString(), title: "Ship it" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(201);
    const { id } = await res.json();

    const task = await Task.findById(id).lean();
    expect(task!.title).toBe("Ship it");
    expect(task!.status).toBe("todo");
  });

  it("rejects the 51st task in a list on the Free plan (maxTasksPerList = 50) with 402 limit_exceeded", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    const list = await seedList(workspace._id.toString(), owner);
    loginAs(owner._id.toString());

    await Task.insertMany(
      Array.from({ length: 50 }, (_, i) => ({
        workspaceId: workspace._id,
        listId: list._id,
        title: `Task ${i}`,
        createdBy: owner._id,
      }))
    );

    const res = await POST(postRequest(workspace._id.toString(), { listId: list._id.toString(), title: "One too many" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("limit_exceeded");
    expect(body.limit).toBe("maxTasksPerList");
  });
});

describe("GET /api/v1/workspaces/[id]/tasks", () => {
  it("filters by status, listId, and a title search", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await seedList(workspace._id.toString(), owner);
    const otherList = await List.create({
      workspaceId: workspace._id,
      name: "Other",
      color: "#000",
      order: 1,
      createdBy: owner._id,
    });
    loginAs(owner._id.toString());

    await Task.insertMany([
      { workspaceId: workspace._id, listId: list._id, title: "Buy milk", status: "todo", createdBy: owner._id },
      { workspaceId: workspace._id, listId: list._id, title: "Buy eggs", status: "done", createdBy: owner._id },
      { workspaceId: workspace._id, listId: otherList._id, title: "Buy bread", status: "todo", createdBy: owner._id },
    ]);

    const byStatus = await GET(getRequest(workspace._id.toString(), "?status=todo"), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    const byStatusBody = await byStatus.json();
    expect(byStatusBody.tasks).toHaveLength(2);

    const byList = await GET(getRequest(workspace._id.toString(), `?listId=${list._id.toString()}`), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    const byListBody = await byList.json();
    expect(byListBody.tasks).toHaveLength(2);

    const byQuery = await GET(getRequest(workspace._id.toString(), "?q=eggs"), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    const byQueryBody = await byQuery.json();
    expect(byQueryBody.tasks).toHaveLength(1);
    expect(byQueryBody.tasks[0].title).toBe("Buy eggs");
  });
});
