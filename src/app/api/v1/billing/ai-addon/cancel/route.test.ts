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
  return new NextRequest("http://localhost:3000/api/v1/billing/ai-addon/cancel", {
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

describe("POST /api/v1/billing/ai-addon/cancel", () => {
  it("cancels the active add-on subscription", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    await Subscription.findOneAndUpdate({ workspaceId: workspace._id }, { "razorpay.aiSubscriptionId": "sub_addon_active" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString() }));
    expect(res.status).toBe(200);
    expect(razorpay.subscriptions.cancel).toHaveBeenCalledWith("sub_addon_active", true);
  });

  it("returns 400 when there's no active add-on", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString() }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("no_active_addon");
  });
});
