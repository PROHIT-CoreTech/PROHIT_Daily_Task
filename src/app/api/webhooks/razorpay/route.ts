import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDb } from "@/lib/db";
import { Subscription } from "@/lib/models/Subscription";
import { GRACE_PERIOD_MS, recomputeEntitlements } from "@/lib/entitlements/compute";
import type { Plan, SubscriptionStatus } from "@/lib/types";

/**
 * No auth middleware here — Razorpay is not a logged-in user. The signature
 * check below is what authenticates the request.
 */

const STATUS_BY_EVENT: Record<string, SubscriptionStatus> = {
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.pending": "past_due",
  "subscription.halted": "past_due",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "expired",
};

const PLAN_BY_RAZORPAY_PLAN_ID: Record<string, Plan> = {
  [process.env.RAZORPAY_PLAN_PRO ?? "plan_pro"]: "pro",
  [process.env.RAZORPAY_PLAN_PRO_STUDENT ?? "plan_pro_student"]: "pro_student",
  [process.env.RAZORPAY_PLAN_TEAM ?? "plan_team"]: "team",
};

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // Read the raw body — re-serialising parsed JSON changes the bytes and
  // breaks the HMAC.
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const payload = JSON.parse(raw);
  const eventType: string = payload.event;
  // Falling back to the subscription's own (constant) entity ID here would
  // make every event on that subscription look like a duplicate of the
  // first one ever processed. A hash of the raw body is still stable across
  // retries of the *same* delivery (identical bytes -> identical hash) but
  // distinguishes genuinely different events.
  const eventId: string =
    req.headers.get("x-razorpay-event-id") ?? crypto.createHash("sha256").update(raw).digest("hex");

  const status = STATUS_BY_EVENT[eventType];
  if (!status) {
    // Unhandled but valid event. 200 stops Razorpay retrying it forever.
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  const entity = payload.payload?.subscription?.entity;
  if (!entity?.id) {
    return NextResponse.json({ ok: true, ignored: "no_subscription_entity" });
  }

  await connectDb();

  const set: Record<string, unknown> = { status };

  if (entity.plan_id && PLAN_BY_RAZORPAY_PLAN_ID[entity.plan_id]) {
    set.plan = PLAN_BY_RAZORPAY_PLAN_ID[entity.plan_id];
  }
  if (typeof entity.quantity === "number") set.seats = entity.quantity;
  if (entity.current_end) {
    set["razorpay.currentPeriodEnd"] = new Date(entity.current_end * 1000);
  }
  set.graceEndsAt =
    status === "past_due" ? new Date(Date.now() + GRACE_PERIOD_MS) : undefined;

  /**
   * Idempotency. The `$ne` guard lives inside the query filter, so
   * check-and-write is a single atomic operation — two concurrent deliveries
   * of the same event cannot both pass it. A separate findOne-then-update
   * would race.
   *
   * $slice keeps the array bounded at the 100 most recent event IDs.
   */
  const result = await Subscription.findOneAndUpdate(
    {
      "razorpay.subscriptionId": entity.id,
      processedEvents: { $ne: eventId },
    },
    {
      $set: set,
      $push: { processedEvents: { $each: [eventId], $slice: -100 } },
    },
    { new: true }
  ).lean<{ workspaceId: string } | null>();

  if (!result) {
    // Either already applied, or no such subscription. Both are 200 —
    // a non-2xx makes Razorpay retry the thing we just correctly ignored.
    return NextResponse.json({ ok: true, deduped: true });
  }

  await recomputeEntitlements(result.workspaceId, eventId);

  return NextResponse.json({ ok: true });
}
