import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { addDays, startOfMonth } from "date-fns";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, createList } from "@/test/factories";
import { Task } from "@/models/Task";
import { GET } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function getRequest(workspaceId: string, query = "") {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/calendar${query}`);
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

describe("GET /api/v1/workspaces/[id]/calendar", () => {
  it("defaults to month view (no gate on Free) and filters to the month's tasks", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    const list = await createList(workspace._id, owner);
    loginAs(owner._id.toString());

    const inMonth = startOfMonth(new Date());
    const nextMonth = addDays(inMonth, 45);

    await Task.insertMany([
      { workspaceId: workspace._id, listId: list._id, title: "In range", dueDate: inMonth, createdBy: owner._id },
      { workspaceId: workspace._id, listId: list._id, title: "Out of range", dueDate: nextMonth, createdBy: owner._id },
    ]);

    const res = await GET(getRequest(workspace._id.toString()), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.view).toBe("month");
    expect(body.tasks.map((t: { title: string }) => t.title)).toEqual(["In range"]);
  });

  it("rejects week view on the Free plan (calendar_week_view off) with 402", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    loginAs(owner._id.toString());

    const res = await GET(getRequest(workspace._id.toString(), "?view=week"), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(402);
  });

  it("allows week view on Pro", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    const res = await GET(getRequest(workspace._id.toString(), "?view=week"), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.view).toBe("week");
  });
});
