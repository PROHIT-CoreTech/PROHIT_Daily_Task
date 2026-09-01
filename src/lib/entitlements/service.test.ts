import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { Workspace } from "@/models/Workspace";
import { Subscription } from "@/models/Subscription";
import { EntitlementCache } from "@/models/EntitlementCache";
import { recomputeEntitlements, getEntitlements } from "./service";

beforeAll(async () => {
  await setupTestDb();
});
afterAll(async () => {
  await teardownTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

async function makeWorkspace(type: "personal" | "team" | "business" = "personal") {
  const ownerId = new Types.ObjectId();
  const workspace = await Workspace.create({
    name: "Test Workspace",
    type,
    ownerId,
    members: [{ userId: ownerId, role: "owner", joinedAt: new Date() }],
  });
  return workspace;
}

describe("recomputeEntitlements + getEntitlements", () => {
  it("defaults an unrecognised/missing subscription to Free (no null-handling needed downstream, spec §1.3)", async () => {
    const workspace = await makeWorkspace();
    await recomputeEntitlements(workspace._id.toString());

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.plan).toBe("free");
    expect(entitlements.limits.maxLists).toBe(5);
  });

  it("recomputes to match the plan stored in `subscriptions`", async () => {
    const workspace = await makeWorkspace();
    await Subscription.create({ workspaceId: workspace._id, plan: "pro", status: "active", seats: 1 });
    await recomputeEntitlements(workspace._id.toString());

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.plan).toBe("pro");
    expect(entitlements.features.flow_board).toBe(true);
    expect(entitlements.limits.maxLists).toBe(-1);
  });

  it("re-running recompute after a plan change updates the cache (webhook-driven flow)", async () => {
    const workspace = await makeWorkspace("team");
    await Subscription.create({ workspaceId: workspace._id, plan: "free", status: "active", seats: 1 });
    await recomputeEntitlements(workspace._id.toString());
    expect((await getEntitlements(workspace._id.toString())).plan).toBe("free");

    await Subscription.findOneAndUpdate({ workspaceId: workspace._id }, { plan: "team", status: "active" });
    await recomputeEntitlements(workspace._id.toString());

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.plan).toBe("team");
    expect(entitlements.limits.maxMembers).toBe(10); // type: "team" -> 10-member cap
  });

  it("business workspaces get the 50-member cap on the team plan, not 10 (spec §D1)", async () => {
    const workspace = await makeWorkspace("business");
    await Subscription.create({ workspaceId: workspace._id, plan: "team", status: "active", seats: 1 });
    await recomputeEntitlements(workspace._id.toString());

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.limits.maxMembers).toBe(50);
  });

  it("falls back to Free (not permissive) when the cache is missing entirely", async () => {
    const workspace = await makeWorkspace();
    // No recomputeEntitlements call at all — cache never written.
    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.plan).toBe("free");
    expect(entitlements.features.flow_board).toBe(false);
  });

  it("falls back to Free when the cache is stale (>48h old) — a false upgrade is a revenue leak (spec §1.4)", async () => {
    const workspace = await makeWorkspace();
    await Subscription.create({ workspaceId: workspace._id, plan: "pro", status: "active", seats: 1 });
    await recomputeEntitlements(workspace._id.toString());

    // Backdate the cache past the 48h degraded-read threshold.
    const staleDate = new Date(Date.now() - 49 * 60 * 60 * 1000);
    await EntitlementCache.findOneAndUpdate({ workspaceId: workspace._id }, { computedAt: staleDate });

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.plan).toBe("free");
    expect(entitlements.features.flow_board).toBe(false);
  });

  it("a cache within the 48h window is still trusted", async () => {
    const workspace = await makeWorkspace();
    await Subscription.create({ workspaceId: workspace._id, plan: "pro", status: "active", seats: 1 });
    await recomputeEntitlements(workspace._id.toString());

    const freshDate = new Date(Date.now() - 47 * 60 * 60 * 1000);
    await EntitlementCache.findOneAndUpdate({ workspaceId: workspace._id }, { computedAt: freshDate });

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.plan).toBe("pro");
  });
});

describe("AI Add-on overlay (BRD §9.2 — sold separately, not bundled into any plan)", () => {
  it("ai_assistant is off by default even on paid plans", async () => {
    const workspace = await makeWorkspace();
    await Subscription.create({ workspaceId: workspace._id, plan: "team", status: "active", seats: 1 });
    await recomputeEntitlements(workspace._id.toString());

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.features.ai_assistant).toBe(false);
  });

  it("turns on when addons.ai is true, regardless of base plan", async () => {
    const workspace = await makeWorkspace();
    await Subscription.create({ workspaceId: workspace._id, plan: "free", status: "active", seats: 1, addons: { ai: true } });
    await recomputeEntitlements(workspace._id.toString());

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.plan).toBe("free");
    expect(entitlements.features.ai_assistant).toBe(true);
    // Rest of the Free matrix is untouched by the add-on.
    expect(entitlements.features.flow_board).toBe(false);
    expect(entitlements.limits.maxLists).toBe(5);
  });

  it("turning the add-on off (re-recompute) removes ai_assistant without touching the base plan", async () => {
    const workspace = await makeWorkspace();
    await Subscription.create({ workspaceId: workspace._id, plan: "pro", status: "active", seats: 1, addons: { ai: true } });
    await recomputeEntitlements(workspace._id.toString());
    expect((await getEntitlements(workspace._id.toString())).features.ai_assistant).toBe(true);

    await Subscription.findOneAndUpdate({ workspaceId: workspace._id }, { "addons.ai": false });
    await recomputeEntitlements(workspace._id.toString());

    const entitlements = await getEntitlements(workspace._id.toString());
    expect(entitlements.features.ai_assistant).toBe(false);
    expect(entitlements.features.flow_board).toBe(true); // still Pro
  });
});
