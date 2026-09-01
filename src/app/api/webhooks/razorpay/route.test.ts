import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { Types } from "mongoose";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { Workspace } from "@/models/Workspace";
import { Subscription } from "@/models/Subscription";
import { EntitlementCache } from "@/models/EntitlementCache";
import { POST } from "./route";

const WEBHOOK_SECRET = "test-webhook-secret"; // matches vitest.config.ts

beforeAll(async () => {
  await setupTestDb();
});
afterAll(async () => {
  await teardownTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

function sign(body: string) {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function webhookRequest(body: object, opts: { eventId?: string; signature?: string } = {}) {
  const raw = JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("x-razorpay-signature", opts.signature ?? sign(raw));
  if (opts.eventId) headers.set("x-razorpay-event-id", opts.eventId);
  return new NextRequest("http://localhost:3000/api/webhooks/razorpay", { method: "POST", body: raw, headers });
}

function subscriptionEvent(event: string, subscriptionId: string, opts: Partial<{ workspaceId: string; plan: string; currentEnd: number }> = {}) {
  return {
    event,
    payload: {
      subscription: {
        entity: {
          id: subscriptionId,
          plan_id: "plan_test",
          status: "active",
          current_end: opts.currentEnd,
          notes: { workspaceId: opts.workspaceId, plan: opts.plan },
        },
      },
    },
  };
}

async function seedWorkspaceWithSubscription(subscriptionId: string) {
  const ownerId = new Types.ObjectId();
  const workspace = await Workspace.create({
    name: "Webhook Test WS",
    type: "personal",
    ownerId,
    members: [{ userId: ownerId, role: "owner", joinedAt: new Date() }],
  });
  await Subscription.create({
    workspaceId: workspace._id,
    plan: "free",
    status: "active",
    seats: 1,
    razorpay: { subscriptionId },
  });
  return workspace;
}

describe("POST /api/webhooks/razorpay", () => {
  it("rejects a request with an invalid signature — 400, no writes", async () => {
    const subId = "sub_bad_sig";
    await seedWorkspaceWithSubscription(subId);
    const body = subscriptionEvent("subscription.activated", subId, { plan: "pro" });
    const res = await POST(webhookRequest(body, { signature: "not-the-real-signature" }));
    expect(res.status).toBe(400);

    const sub = await Subscription.findOne({ "razorpay.subscriptionId": subId });
    expect(sub!.plan).toBe("free"); // untouched
  });

  it("applies a correctly signed subscription.activated event and recomputes entitlements", async () => {
    const subId = "sub_ok";
    const workspace = await seedWorkspaceWithSubscription(subId);
    const body = subscriptionEvent("subscription.activated", subId, { plan: "pro" });

    const res = await POST(webhookRequest(body, { eventId: "evt_1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const sub = await Subscription.findOne({ "razorpay.subscriptionId": subId });
    expect(sub!.plan).toBe("pro");
    expect(sub!.status).toBe("active");
    expect(sub!.processedEvents).toEqual(["evt_1"]);

    const cache = await EntitlementCache.findOne({ workspaceId: workspace._id });
    expect(cache!.plan).toBe("pro");
    expect(cache!.features!.flow_board).toBe(true);
  });

  it("is idempotent: redelivering the same event id is a no-op, not a second apply (spec §4.2 / BRD §7)", async () => {
    const subId = "sub_dupe";
    await seedWorkspaceWithSubscription(subId);
    const activate = subscriptionEvent("subscription.activated", subId, { plan: "pro" });

    const first = await POST(webhookRequest(activate, { eventId: "evt_dupe" }));
    expect((await first.json()).deduped).toBeUndefined();

    // Redeliver the identical event (Razorpay retries webhooks) — same event id.
    const second = await POST(webhookRequest(activate, { eventId: "evt_dupe" }));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, deduped: true });

    const sub = await Subscription.findOne({ "razorpay.subscriptionId": subId });
    // processedEvents must not grow — the duplicate must not push a second entry.
    expect(sub!.processedEvents).toEqual(["evt_dupe"]);
  });

  it("a genuinely new event for the same subscription still applies (dedup is per-event, not per-subscription)", async () => {
    const subId = "sub_sequence";
    await seedWorkspaceWithSubscription(subId);

    await POST(webhookRequest(subscriptionEvent("subscription.activated", subId, { plan: "pro" }), { eventId: "evt_a" }));
    await POST(webhookRequest(subscriptionEvent("subscription.cancelled", subId), { eventId: "evt_b" }));

    const sub = await Subscription.findOne({ "razorpay.subscriptionId": subId });
    expect(sub!.status).toBe("cancelled");
    expect(sub!.processedEvents).toEqual(["evt_a", "evt_b"]);
  });

  it("ignores non-subscription events (e.g. payment.*) without erroring", async () => {
    const res = await POST(
      webhookRequest({ event: "payment.captured", payload: {} }, { eventId: "evt_payment" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: true });
  });

  it("does not error when the subscriptionId isn't linked yet (race with checkout) — dedupes gracefully", async () => {
    const body = subscriptionEvent("subscription.activated", "sub_unknown", { plan: "pro" });
    const res = await POST(webhookRequest(body, { eventId: "evt_unknown" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: true });
  });
});

describe("POST /api/webhooks/razorpay — AI Add-on subscription (separate from the base plan)", () => {
  async function seedWorkspaceWithAddon(aiSubscriptionId: string) {
    const ownerId = new Types.ObjectId();
    const workspace = await Workspace.create({
      name: "Addon Test WS",
      type: "personal",
      ownerId,
      members: [{ userId: ownerId, role: "owner", joinedAt: new Date() }],
    });
    await Subscription.create({
      workspaceId: workspace._id,
      plan: "free",
      status: "active",
      seats: 1,
      razorpay: { aiSubscriptionId },
    });
    return workspace;
  }

  it("activating the add-on subscription sets addons.ai without touching plan/status", async () => {
    const addonSubId = "sub_addon_1";
    const workspace = await seedWorkspaceWithAddon(addonSubId);

    const res = await POST(
      webhookRequest(subscriptionEvent("subscription.activated", addonSubId), { eventId: "evt_addon_1" })
    );
    expect(res.status).toBe(200);

    const sub = await Subscription.findOne({ "razorpay.aiSubscriptionId": addonSubId });
    expect(sub!.addons!.ai).toBe(true);
    expect(sub!.plan).toBe("free"); // base plan untouched

    const cache = await EntitlementCache.findOne({ workspaceId: workspace._id });
    expect(cache!.features!.ai_assistant).toBe(true);
    expect(cache!.plan).toBe("free");
  });

  it("cancelling the add-on subscription clears addons.ai", async () => {
    const addonSubId = "sub_addon_2";
    await seedWorkspaceWithAddon(addonSubId);

    await POST(webhookRequest(subscriptionEvent("subscription.activated", addonSubId), { eventId: "evt_addon_a" }));
    await POST(webhookRequest(subscriptionEvent("subscription.completed", addonSubId), { eventId: "evt_addon_b" }));

    const sub = await Subscription.findOne({ "razorpay.aiSubscriptionId": addonSubId });
    expect(sub!.addons!.ai).toBe(false);
  });

  it("is idempotent for add-on events too — a redelivered event doesn't reprocess", async () => {
    const addonSubId = "sub_addon_3";
    await seedWorkspaceWithAddon(addonSubId);
    const activate = subscriptionEvent("subscription.activated", addonSubId);

    await POST(webhookRequest(activate, { eventId: "evt_addon_dupe" }));
    const second = await POST(webhookRequest(activate, { eventId: "evt_addon_dupe" }));
    expect(await second.json()).toEqual({ ok: true, deduped: true });

    const sub = await Subscription.findOne({ "razorpay.aiSubscriptionId": addonSubId });
    expect(sub!.processedEvents).toEqual(["evt_addon_dupe"]);
  });
});
