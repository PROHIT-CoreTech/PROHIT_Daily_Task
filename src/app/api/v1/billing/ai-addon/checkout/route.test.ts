import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/razorpay", () => ({
  razorpay: { subscriptions: { create: vi.fn(), cancel: vi.fn() } },
  RAZORPAY_PLAN_IDS: { pro: "plan_test_pro", pro_student: "plan_test_pro_student", team: "plan_test_team" },
  RAZORPAY_PLAN_AI_ADDON: "plan_test_addon",
}));

import { auth } from "@/lib/auth";
import { razorpay } from "@/lib/razorpay";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, addMember } from "@/test/factories";
import { POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/billing/ai-addon/checkout", {
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
  (razorpay.subscriptions.create as Mock).mockResolvedValue({ id: "sub_addon_test" });
});

describe("POST /api/v1/billing/ai-addon/checkout", () => {
  it("creates an add-on subscription independent of the base plan, sized to member count", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "free" });
    const teammate = await createUser();
    await addMember(workspace, teammate, "member");
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString() }));
    expect(res.status).toBe(200);
    expect(razorpay.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: "plan_test_addon", quantity: 2, total_count: 120 })
    );
  });

  it("works on a Free-plan personal workspace too — the add-on isn't gated by base plan/type", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "personal", plan: "free" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString() }));
    expect(res.status).toBe(200);
  });

  it("rejects a non-owner with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "personal", plan: "free" });
    const other = await createUser();
    loginAs(other._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString() }));
    expect(res.status).toBe(403);
  });
});
