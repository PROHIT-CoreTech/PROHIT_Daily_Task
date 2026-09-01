import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/middleware";
import { PLAN_PRICING } from "@/lib/entitlements/matrix";
import { entitlementsFor } from "@/lib/entitlements/matrix";

/**
 * Drives the upgrade screen. Prices/features are never hardcoded in the
 * client — this is the one place they come from (spec §2.3 note).
 */
export async function GET() {
  return withErrorHandling(async () => {
    const plans = (["free", "pro", "pro_student", "team"] as const).map((plan) => ({
      plan,
      ...PLAN_PRICING[plan],
      features: entitlementsFor(plan, plan === "team" ? "team" : "personal").features,
      limits: entitlementsFor(plan, plan === "team" ? "team" : "personal").limits,
    }));

    return NextResponse.json({ plans });
  });
}
