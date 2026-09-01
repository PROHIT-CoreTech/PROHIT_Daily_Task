import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace, withErrorHandling, forbidden, ApiError } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { razorpay, RAZORPAY_PLAN_AI_ADDON } from "@/lib/razorpay";

const CheckoutSchema = z.object({ workspaceId: z.string() });

/**
 * AI Add-on billed as its own Razorpay subscription, separate from the
 * base plan (BRD §9.2 — sold on top of any plan, not bundled). Available
 * to any workspace type/plan, unlike vertical modules.
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = CheckoutSchema.parse(await req.json());
    const { workspace, role } = await withWorkspace(body.workspaceId);
    if (role !== "owner") throw forbidden("Only the workspace owner can manage add-ons.");

    if (!RAZORPAY_PLAN_AI_ADDON) {
      throw new ApiError(500, { error: "addon_not_configured", message: "The AI Add-on is not configured for checkout yet." });
    }

    const seats = Math.max(workspace.members.length, 1);

    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: RAZORPAY_PLAN_AI_ADDON,
      customer_notify: 1,
      quantity: seats,
      total_count: 120, // monthly billing, 10 years of cycles
      notes: { workspaceId: body.workspaceId, addon: "ai" },
    });

    await connectToDatabase();
    await Subscription.findOneAndUpdate(
      { workspaceId: body.workspaceId },
      { $set: { "razorpay.aiSubscriptionId": razorpaySubscription.id } }
    );

    return NextResponse.json({
      razorpaySubscriptionId: razorpaySubscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  });
}
