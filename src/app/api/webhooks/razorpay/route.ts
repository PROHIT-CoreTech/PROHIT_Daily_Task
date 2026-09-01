import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { recomputeEntitlements } from "@/lib/entitlements/service";
import { addDays } from "date-fns";
import type { Plan } from "@/lib/entitlements/matrix";

// No auth middleware on this route — Razorpay calls it directly.
// Authenticity comes from the HMAC signature, not a session (spec §2.3).

type RazorpayEvent = {
  event: string;
  payload: {
    subscription: {
      entity: {
        id: string;
        plan_id: string;
        status: string;
        current_end?: number; // unix seconds
        notes?: { workspaceId?: string; plan?: string; addon?: string };
      };
    };
  };
};

const STATUS_MAP: Record<string, "active" | "past_due" | "cancelled" | "expired"> = {
  activated: "active",
  charged: "active",
  pending: "past_due",
  halted: "past_due",
  cancelled: "cancelled",
  completed: "expired",
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as RazorpayEvent;
  const eventId = req.headers.get("x-razorpay-event-id") ?? `${event.event}:${Date.now()}`;
  const entity = event.payload?.subscription?.entity;

  if (!entity) {
    // Non-subscription events (payment.*, etc.) — acknowledge, nothing to do yet.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const eventKey = event.event.replace("subscription.", "");
  const mappedStatus = STATUS_MAP[eventKey];
  if (!mappedStatus) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await connectToDatabase();

  const plan = entity.notes?.plan as Plan | undefined;
  const periodEnd = entity.current_end ? new Date(entity.current_end * 1000) : addDays(new Date(), 30);

  // Idempotent, atomic check-and-write: the `processedEvents: { $ne }`
  // guard inside the filter makes two concurrent deliveries of the same
  // event impossible to both pass (spec §4.2). Try the base-plan
  // subscription id first, then the AI Add-on subscription id — Razorpay
  // subscriptions are one plan each, so the add-on is a second
  // subscription tracked on the same workspace document.
  let result = await Subscription.findOneAndUpdate(
    { "razorpay.subscriptionId": entity.id, processedEvents: { $ne: eventId } },
    {
      $set: {
        status: mappedStatus,
        ...(plan ? { plan } : {}),
        "razorpay.currentPeriodEnd": periodEnd,
      },
      $push: { processedEvents: { $slice: -100, $each: [eventId] } },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    result = await Subscription.findOneAndUpdate(
      { "razorpay.aiSubscriptionId": entity.id, processedEvents: { $ne: eventId } },
      {
        $set: {
          "addons.ai": mappedStatus === "active",
          "razorpay.aiCurrentPeriodEnd": periodEnd,
        },
        $push: { processedEvents: { $slice: -100, $each: [eventId] } },
      },
      { returnDocument: "after" }
    );
  }

  if (!result) {
    // Either already processed, or the subscriptionId isn't linked yet
    // (race with checkout). Either way, 200 — a non-2xx makes Razorpay
    // retry the thing we just correctly ignored.
    return NextResponse.json({ ok: true, deduped: true });
  }

  await recomputeEntitlements(result.workspaceId.toString(), eventId);

  return NextResponse.json({ ok: true });
}
