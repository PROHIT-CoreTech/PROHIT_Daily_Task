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
    if (role !== "owner") throw forbidden("Only the workspace owner can manage add-ons.");

    await connectToDatabase();
    const subscription = await Subscription.findOne({ workspaceId: body.workspaceId });
    if (!subscription?.razorpay?.aiSubscriptionId) {
      throw new ApiError(400, { error: "no_active_addon", message: "This workspace has no active AI Add-on." });
    }

    await razorpay.subscriptions.cancel(subscription.razorpay.aiSubscriptionId, true);

    return NextResponse.json({ ok: true });
  });
}
