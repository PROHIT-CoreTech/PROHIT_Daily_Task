import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { EntitlementSet, FeatureFlags, Limits } from "@/lib/entitlements/matrix";

// Deliberately has zero dependency on @/lib/auth (and therefore next-auth) —
// next-auth's internal module resolution breaks under Vitest, and none of
// this gating logic needs a session anyway. Keeping it dependency-free also
// makes it directly unit-testable. See middleware.ts for the auth-coupled
// withAuth/withWorkspace/withEntitlements that build on top of this.

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.message === "string" ? body.message : "API error");
    this.status = status;
    this.body = body;
  }
}

export function unauthorized() {
  return new ApiError(401, { error: "unauthorized", message: "Sign in required." });
}

export function forbidden(message = "You do not have access to this resource.") {
  return new ApiError(403, { error: "forbidden", message });
}

/**
 * Gate on a boolean feature flag. Returns 402 (not 403) so the client can
 * distinguish "not allowed" from "needs upgrade" without string-matching
 * error messages (spec §2.2).
 */
export function requireFeature(entitlements: EntitlementSet, feature: keyof FeatureFlags) {
  if (entitlements.features[feature]) return;
  throw new ApiError(402, {
    error: "entitlement_required",
    feature,
    currentPlan: entitlements.plan,
    message: featureUpgradeMessage(feature),
  });
}

/**
 * Gate on a numeric limit. `currentCount` is supplied by the caller
 * (server-computed, never trusted from the client). -1 means unlimited.
 */
export function requireLimit(entitlements: EntitlementSet, limit: keyof Limits, currentCount: number) {
  const max = entitlements.limits[limit];
  if (max === -1 || currentCount < max) return;
  throw new ApiError(402, {
    error: "limit_exceeded",
    limit,
    current: currentCount,
    max,
    currentPlan: entitlements.plan,
  });
}

function featureUpgradeMessage(feature: keyof FeatureFlags): string {
  const messages: Record<keyof FeatureFlags, string> = {
    flow_board: "Flow Board is available on Pro.",
    calendar_week_view: "Week and day calendar views are available on Pro.",
    calendar_bridge: "Calendar Bridge is available on Pro and Team.",
    unlimited_attachments: "Attachments are available on Pro.",
    multiple_reminders: "Multiple Sticky Alerts per task are available on Pro.",
    deep_work: "Deep Work Sprint is coming soon.",
    ai_assistant: "Quick Recap (AI) is coming in a future release.",
    team_dashboard: "The team dashboard is available on Team workspaces.",
  };
  return messages[feature];
}

/** Wraps a route handler body, converting ApiError into a JSON response. */
export async function withErrorHandling(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid request.", issues: err.issues },
        { status: 400 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "internal_error", message: "Something went wrong." }, { status: 500 });
  }
}
