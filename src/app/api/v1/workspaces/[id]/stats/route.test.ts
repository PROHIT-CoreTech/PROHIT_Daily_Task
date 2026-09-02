import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { subDays } from "date-fns";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, createList } from "@/test/factories";
import { Task } from "@/models/Task";
import { GET } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function getRequest(workspaceId: string) {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/stats`);
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

describe("GET /api/v1/workspaces/[id]/stats", () => {
  it("returns counts and a 14-day trend, omitting teamBreakdown on Pro", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    loginAs(owner._id.toString());

    await Task.insertMany([
      { workspaceId: workspace._id, listId: list._id, title: "Done", completedAt: new Date(), createdBy: owner._id },
      {
        workspaceId: workspace._id,
        listId: list._id,
        title: "Overdue",
        dueDate: subDays(new Date(), 1),
        createdBy: owner._id,
      },
      { workspaceId: workspace._id, listId: list._id, title: "Open", createdBy: owner._id },
    ]);

    const res = await GET(getRequest(workspace._id.toString()), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalTasks).toBe(3);
    expect(body.completedTasks).toBe(1);
    expect(body.overdueTasks).toBe(1);
    expect(body.completionRate).toBe(33);
    expect(body.trend).toHaveLength(14);
    expect(body.teamBreakdown).toBeUndefined();
  });

  it("includes teamBreakdown on a Team plan", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "team" });
    const list = await createList(workspace._id, owner);
    loginAs(owner._id.toString());

    await Task.create({ workspaceId: workspace._id, listId: list._id, title: "Assigned", assigneeId: owner._id, createdBy: owner._id });

    const res = await GET(getRequest(workspace._id.toString()), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    const body = await res.json();
    expect(body.teamBreakdown).toBeDefined();
    expect(Array.isArray(body.teamBreakdown)).toBe(true);
  });
});
