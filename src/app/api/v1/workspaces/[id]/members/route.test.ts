import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, addMember } from "@/test/factories";
import { Workspace } from "@/models/Workspace";
import { POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(workspaceId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/workspaces/${workspaceId}/members`, {
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

describe("POST /api/v1/workspaces/[id]/members", () => {
  it("lets the owner add an existing user by email with the given role", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "team" });
    const invitee = await createUser({ email: "invitee@example.com" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { email: "invitee@example.com", role: "admin" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(201);

    const updated = await Workspace.findById(workspace._id).lean();
    const member = updated!.members.find((m) => m.userId.toString() === invitee._id.toString());
    expect(member).toBeDefined();
    expect(member!.role).toBe("admin");
  });

  it("rejects a plain member (not owner/admin) with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "team" });
    const member = await createUser();
    await addMember(workspace, member, "member");
    await createUser({ email: "invitee2@example.com" });
    loginAs(member._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { email: "invitee2@example.com" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects adding members to a personal workspace with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "personal", plan: "pro" });
    await createUser({ email: "invitee3@example.com" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { email: "invitee3@example.com" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 user_not_found for an email with no account", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "team" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { email: "nobody@example.com" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("user_not_found");
  });

  it("returns 409 already_member when the invitee is already on the workspace", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "team" });
    const already = await createUser({ email: "already@example.com" });
    await addMember(workspace, already, "member");
    loginAs(owner._id.toString());

    const res = await POST(postRequest(workspace._id.toString(), { email: "already@example.com" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("already_member");
  });

  it("rejects the 11th member on a team workspace (maxMembers = 10) with 402 limit_exceeded", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "team" });
    loginAs(owner._id.toString());

    // Owner is already member #1 — add 9 more directly to reach the cap of 10.
    for (let i = 0; i < 9; i++) {
      const m = await createUser();
      await addMember(workspace, m, "member");
    }

    await createUser({ email: "eleventh@example.com" });
    const res = await POST(postRequest(workspace._id.toString(), { email: "eleventh@example.com" }), {
      params: Promise.resolve({ id: workspace._id.toString() }),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("limit_exceeded");
    expect(body.limit).toBe("maxMembers");
  });
});
