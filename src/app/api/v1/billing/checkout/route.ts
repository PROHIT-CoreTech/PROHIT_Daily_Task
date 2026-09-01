import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspace, withErrorHandling, forbidden, ApiError } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { razorpay, RAZORPAY_PLAN_IDS } from "@/lib/razorpay";
import { PLAN_ALLOWED_TYPES, type Plan } from "@/lib/entitlements/matrix";

const CheckoutSchema = z.object({
  workspaceId: z.string(),
  plan: z.enum(["pro", "pro_student", "team"]),
});

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = CheckoutSchema.parse(await req.json());
    const { workspace, role, userId } = await withWorkspace(body.workspaceId);
    if (role !== "owner") throw forbidden("Only the workspace owner can change the plan.");

    const plan = body.plan as Plan;
    if (!PLAN_ALLOWED_TYPES[plan].includes(workspace.type as "personal" | "team" | "business")) {
      throw new ApiError(400, {
        error: "plan_type_mismatch",
        message: `The ${plan} plan is not available for a ${workspace.type} workspace.`,
      });
    }

    if (plan === "pro_student") {
      await connectToDatabase();
      const user = await User.findById(userId).lean();
      const verified =
        user?.studentVerification && new Date(user.studentVerification.expiresAt) > new Date();
      if (!verified) {
        throw new ApiError(403, {
          error: "student_not_verified",
          message: "Verify your college email before subscribing to the student plan.",
        });
      }
    }

    const razorpayPlanId = RAZORPAY_PLAN_IDS[plan];
    if (!razorpayPlanId) {
      throw new ApiError(500, { error: "plan_not_configured", message: "This plan is not configured for checkout yet." });
    }

    const seats = plan === "team" ? Math.max(workspace.members.length, 1) : 1;

    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      quantity: seats,
      total_count: plan === "team" ? 120 : 5, // monthly x10y vs yearly x5y billing cycles
      notes: { workspaceId: body.workspaceId, plan },
    });

    await connectToDatabase();
    await Subscription.findOneAndUpdate(
      { workspaceId: body.workspaceId },
      { $set: { "razorpay.subscriptionId": razorpaySubscription.id, "razorpay.planId": razorpayPlanId } }
    );

    return NextResponse.json({
      razorpaySubscriptionId: razorpaySubscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  });
}
