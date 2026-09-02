import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace } from "@/test/factories";
import { List } from "@/models/List";
import { GET, POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(workspaceId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/lists`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(workspaceId: string) {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/lists`);
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

describe("POST /api/v1/workspaces/[id]/lists", () => {
  it("creates a list as a member, incrementing order on subsequent creates", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    const first = await POST(postRequest(workspace._id.toString(), { name: "Work" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(first.status).toBe(201);
    const { id: firstId } = await first.json();
    const firstList = await List.findById(firstId).lean();
    expect(firstList!.order).toBe(0);

    const second = await POST(postRequest(workspace._id.toString(), { name: "Personal" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    const { id: secondId } = await second.json();
    const secondList = await List.findById(secondId).lean();
    expect(secondList!.order).toBe(1);
  });

  it("rejects a non-member with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const outsider = await createUser();
    loginAs(outsider._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { name: "Nope" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects creating a 6th list on the Free plan (maxLists = 5) with 402 limit_exceeded", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    loginAs(owner._id.toString());

    await List.insertMany(
      Array.from({ length: 5 }, (_, i) => ({
        workspaceId: workspace._id,
        name: `List ${i}`,
        color: "#000000",
        order: i,
        createdBy: owner._id,
      }))
    );

    const res = await POST(postRequest(workspace._id.toString(), { name: "One too many" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("limit_exceeded");
    expect(body.limit).toBe("maxLists");
  });
});

describe("GET /api/v1/workspaces/[id]/lists", () => {
  it("returns lists sorted by order, excluding archived ones", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    loginAs(owner._id.toString());

    await List.insertMany([
      { workspaceId: workspace._id, name: "Second", color: "#000", order: 1, createdBy: owner._id },
      { workspaceId: workspace._id, name: "First", color: "#000", order: 0, createdBy: owner._id },
      {
        workspaceId: workspace._id,
        name: "Archived",
        color: "#000",
        order: 2,
        createdBy: owner._id,
        archivedAt: new Date(),
      },
    ]);

    const res = await GET(getRequest(workspace._id.toString()), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lists.map((l: { name: string }) => l.name)).toEqual(["First", "Second"]);
  });
});
