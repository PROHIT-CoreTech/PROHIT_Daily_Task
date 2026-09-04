import { NextResponse } from "next/server";
import { PLAN_MATRIX } from "@/lib/entitlements/matrix";

/**
 * Server-driven pricing. The upgrade screen renders from this response rather
 * than hardcoded values — that is what stops the two wireframe frames from
 * disagreeing on the student price the way the design pack does.
 */
export async function GET() {
  return NextResponse.json({
    currency: "INR",
    plans: [
      {
        id: "free",
        name: "Free",
        priceMinor: 0,
        interval: null,
        display: "₹0",
        ...PLAN_MATRIX.free,
      },
      {
        id: "pro",
        name: "Pro",
        priceMinor: 99900,
        interval: "year",
        display: "₹999/year",
        ...PLAN_MATRIX.pro,
      },
      {
        id: "pro_student",
        name: "Pro (Student)",
        priceMinor: 49900,
        interval: "year",
        display: "₹499/year",
        requiresVerification: "college_email",
        ...PLAN_MATRIX.pro_student,
      },
      {
        id: "team",
        name: "Team",
        priceMinor: 14900,
        interval: "month",
        perSeat: true,
        display: "₹149/user/month",
        ...PLAN_MATRIX.team,
      },
    ],
    addons: [
      { id: "ai", name: "AI Add-on", priceMinor: 9900, interval: "month", perSeat: true, display: "₹99/user/month", available: false },
      { id: "vertical_module", name: "Vertical Module", priceMinor: 19900, interval: "month", perSeat: true, display: "₹199/user/month", available: false, requires: { workspaceType: "business", plan: "team" } },
    ],
  });
}
