import { connectToDatabase } from "@/lib/db";
import { EntitlementCache } from "@/models/EntitlementCache";
import { Subscription } from "@/models/Subscription";
import { Workspace } from "@/models/Workspace";
import { entitlementsFor, type EntitlementSet, type Plan } from "./matrix";

const DEGRADED_READ_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours, spec §1.4

const FREE_FALLBACK: EntitlementSet = entitlementsFor("free", "personal");

/**
 * Recomputes and persists the entitlement cache for a workspace from the
 * plan/status matrix. Called after: workspace creation, and every
 * Razorpay webhook event that changes subscription state. This is the
 * ONLY function that writes entitlements_cache.
 */
export async function recomputeEntitlements(workspaceId: string, sourceEventId?: string) {
  await connectToDatabase();

  const [workspace, subscription] = await Promise.all([
    Workspace.findById(workspaceId).lean(),
    Subscription.findOne({ workspaceId }).lean(),
  ]);

  if (!workspace) throw new Error(`recomputeEntitlements: workspace ${workspaceId} not found`);

  const plan = (subscription?.plan ?? "free") as Plan;
  const status = subscription?.status ?? "active";
  const set = entitlementsFor(plan, workspace.type as "personal" | "team" | "business");

  // AI Add-on is a separate purchase layered on top of any base plan
  // (BRD §9.2) — overlay it onto the base matrix rather than baking it
  // into entitlementsFor, since it doesn't depend on plan/type at all.
  set.features.ai_assistant = subscription?.addons?.ai ?? false;

  await EntitlementCache.findOneAndUpdate(
    { workspaceId },
    {
      $set: {
        features: set.features,
        limits: set.limits,
        modules: workspace.activeModules ?? [],
        plan,
        status,
        computedAt: new Date(),
        sourceEventId,
      },
    },
    { upsert: true }
  );
}

/**
 * Reads the entitlement cache for gating decisions. Never queries
 * `subscriptions` directly (spec §D4). If the cache is missing or stale,
 * falls back to Free limits rather than permissive access — a false
 * downgrade is a support ticket, a false upgrade is a revenue leak
 * nobody reports (spec §1.4 "degraded read").
 */
export async function getEntitlements(workspaceId: string): Promise<EntitlementSet> {
  await connectToDatabase();

  const cache = await EntitlementCache.findOne({ workspaceId }).lean();

  if (!cache) return FREE_FALLBACK;

  const age = Date.now() - new Date(cache.computedAt).getTime();
  if (age > DEGRADED_READ_MAX_AGE_MS) {
    console.error(`[entitlements] stale cache for workspace ${workspaceId} (age ${age}ms) — falling back to Free`);
    return FREE_FALLBACK;
  }

  return {
    plan: cache.plan as Plan,
    features: cache.features as EntitlementSet["features"],
    limits: cache.limits as EntitlementSet["limits"],
  };
}
