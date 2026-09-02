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
import { createUser, createWorkspace } from "@/test/factories";
import { Subscription } from "@/models/Subscription";
import { POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/billing/cancel", {
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

describe("POST /api/v1/billing/cancel", () => {
  it("cancels the active subscription at cycle end", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    await Subscription.findOneAndUpdate({ workspaceId: workspace._id }, { "razorpay.subscriptionId": "sub_active" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString() }));
    expect(res.status).toBe(200);
    expect(razorpay.subscriptions.cancel).toHaveBeenCalledWith("sub_active", true);
  });

  it("returns 400 when there's no active subscription", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString() }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("no_active_subscription");
  });

  it("rejects a non-owner with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const other = await createUser();
    loginAs(other._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString() }));
    expect(res.status).toBe(403);
  });
});
