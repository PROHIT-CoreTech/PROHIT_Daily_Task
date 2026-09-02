import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

// Must stay in this file (not a shared helper) so Vitest's hoisting puts it
// above every import below — @/lib/api/middleware -> @/lib/auth calls
// NextAuth({...}) at module scope, which breaks under Vitest (see
// src/lib/api/errors.ts's comment). Mocking @/lib/auth here means the real
// next-auth module is never loaded.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser } from "@/test/factories";
import { Workspace } from "@/models/Workspace";
import { Subscription } from "@/models/Subscription";
import { List } from "@/models/List";
import { EntitlementCache } from "@/models/EntitlementCache";
import { POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function logout() {
  (auth as unknown as Mock).mockResolvedValue(null);
}

function createRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/workspaces", {
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

describe("POST /api/v1/workspaces", () => {
  it("creates a team workspace with a default list, subscription, and entitlement cache", async () => {
    const user = await createUser();
    loginAs(user._id.toString());

    const res = await POST(createRequest({ name: "Acme Team", type: "team" }));
    expect(res.status).toBe(201);
    const { id } = await res.json();

    const workspace = await Workspace.findById(id).lean();
    expect(workspace!.type).toBe("team");
    expect(workspace!.members).toHaveLength(1);
    expect(workspace!.members[0].role).toBe("owner");

    const sub = await Subscription.findOne({ workspaceId: id }).lean();
    expect(sub!.plan).toBe("team");

    const lists = await List.find({ workspaceId: id }).lean();
    expect(lists).toHaveLength(1);
    expect(lists[0].name).toBe("General");

    const cache = await EntitlementCache.findOne({ workspaceId: id }).lean();
    expect(cache!.features!.team_dashboard).toBe(true);
    expect(cache!.plan).toBe("team");
  });

  it("creates a business workspace", async () => {
    const user = await createUser();
    loginAs(user._id.toString());

    const res = await POST(createRequest({ name: "Acme Biz", type: "business" }));
    expect(res.status).toBe(201);
    const { id } = await res.json();

    const workspace = await Workspace.findById(id).lean();
    expect(workspace!.type).toBe("business");
  });

  it("rejects unauthenticated requests with 401", async () => {
    logout();

    const res = await POST(createRequest({ name: "Nope", type: "team" }));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid workspace type with 400", async () => {
    const user = await createUser();
    loginAs(user._id.toString());

    // "personal" workspaces are auto-provisioned at signup only, not via this route.
    const res = await POST(createRequest({ name: "Bad", type: "personal" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });
});
