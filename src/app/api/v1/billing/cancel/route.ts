import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace, withErrorHandling, forbidden, ApiError } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { razorpay } from "@/lib/razorpay";

const CancelSchema = z.object({ workspaceId: z.string() });

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = CancelSchema.parse(await req.json());
    const { role } = await withWorkspace(body.workspaceId);
    if (role !== "owner") throw forbidden("Only the workspace owner can cancel the plan.");

    await connectToDatabase();
    const subscription = await Subscription.findOne({ workspaceId: body.workspaceId });
    if (!subscription?.razorpay?.subscriptionId) {
      throw new ApiError(400, { error: "no_active_subscription", message: "This workspace has no paid subscription." });
    }

    // cancel_at_cycle_end = 1: features run to currentPeriodEnd (spec §4.3),
    // the actual status flip happens via the subscription.cancelled webhook.
    await razorpay.subscriptions.cancel(subscription.razorpay.subscriptionId, true);

    return NextResponse.json({ ok: true });
  });
}
