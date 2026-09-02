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
import { User } from "@/models/User";
import { POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/billing/checkout", {
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
  (razorpay.subscriptions.create as Mock).mockResolvedValue({ id: "sub_test_123" });
});

describe("POST /api/v1/billing/checkout", () => {
  it("creates a Razorpay subscription for the pro plan with the right plan_id/quantity/total_count", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "personal", plan: "free" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString(), plan: "pro" }));
    expect(res.status).toBe(200);

    expect(razorpay.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: "plan_test_pro", quantity: 1, total_count: 5 })
    );
  });

  it("creates a subscription for the team plan sized to the current member count", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "team", plan: "free" });
    const teammate = await createUser();
    await addMember(workspace, teammate, "member");
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString(), plan: "team" }));
    expect(res.status).toBe(200);

    expect(razorpay.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: "plan_test_team", quantity: 2, total_count: 120 })
    );
  });

  it("rejects a non-owner with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "personal", plan: "free" });
    const other = await createUser();
    loginAs(other._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString(), plan: "pro" }));
    expect(res.status).toBe(403);
    expect(razorpay.subscriptions.create).not.toHaveBeenCalled();
  });

  it("rejects pro_student without a verified student email with 403", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "personal", plan: "free" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString(), plan: "pro_student" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("student_not_verified");
  });

  it("allows pro_student once the student email is verified", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "personal", plan: "free" });
    await User.findByIdAndUpdate(owner._id, {
      studentVerification: {
        collegeEmail: "me@college.edu",
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString(), plan: "pro_student" }));
    expect(res.status).toBe(200);
  });

  it("rejects a plan/workspace type mismatch (team plan on a personal workspace) with 400", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { type: "personal", plan: "free" });
    loginAs(owner._id.toString());

    const res = await POST(postRequest({ workspaceId: workspace._id.toString(), plan: "team" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("plan_type_mismatch");
  });
});
