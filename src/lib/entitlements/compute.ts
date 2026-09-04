import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Workspace } from "@/lib/models/Workspace";
import { Subscription } from "@/lib/models/Subscription";
import { EntitlementCache } from "@/lib/models/EntitlementCache";
import { List } from "@/lib/models/List";
import { degradedEntitlements, resolveEntitlements } from "./matrix";
import type { EntitlementSet, Plan, SubscriptionStatus, WorkspaceType } from "@/lib/types";
import { UNLIMITED } from "@/lib/types";

/** A cache row older than this is treated as untrustworthy. */
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

/** A failed payment keeps full access for this long before downgrading. */
export const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Recomputes and persists the entitlement cache for a workspace. Called from
 * the Razorpay webhook handler and from workspace creation. This is the only
 * writer of EntitlementCache.
 */
export async function recomputeEntitlements(
  workspaceId: Types.ObjectId | string,
  sourceEventId?: string
): Promise<EntitlementSet> {
  await connectDb();

  const [workspace, subscription] = await Promise.all([
    Workspace.findById(workspaceId).lean<{ type: WorkspaceType } | null>(),
    Subscription.findOne({ workspaceId }).lean<{
      plan: Plan;
      status: SubscriptionStatus;
      addons: { ai: boolean; modules: string[] };
      graceEndsAt?: Date;
    } | null>(),
  ]);

  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

  const plan = subscription?.plan ?? "free";
  const status = subscription?.status ?? "active";

  // past_due keeps full entitlements during the grace window. An expired card
  // is the most common failure and the least deliberate — cutting access
  // instantly punishes users for something they did not choose.
  const inGrace =
    status === "past_due" &&
    (!subscription?.graceEndsAt || subscription.graceEndsAt.getTime() > Date.now());

  const entitled = status === "active" || status === "cancelled" || inGrace;
  const effectivePlan: Plan = entitled ? plan : "free";

  const { features, limits, modules } = resolveEntitlements(
    effectivePlan,
    workspace.type,
    {
      modules: entitled ? subscription?.addons?.modules ?? [] : [],
      aiAddon: entitled ? subscription?.addons?.ai ?? false : false,
    }
  );

  await EntitlementCache.findOneAndUpdate(
    { workspaceId },
    {
      $set: {
        features,
        limits,
        modules,
        plan: effectivePlan,
        status,
        computedAt: new Date(),
        ...(sourceEventId ? { sourceEventId } : {}),
      },
    },
    { upsert: true }
  );

  await applyDowngradeFreeze(workspaceId, limits.maxLists);

  return { features, limits, modules, plan: effectivePlan, status };
}

/**
 * Data is never deleted on downgrade. Lists beyond the plan's cap are frozen
 * read-only (newest first, so the user keeps their oldest/most-established
 * lists) and unfreeze automatically on re-upgrade.
 */
async function applyDowngradeFreeze(
  workspaceId: Types.ObjectId | string,
  maxLists: number
): Promise<void> {
  if (maxLists === UNLIMITED) {
    await List.updateMany({ workspaceId, readOnly: true }, { $set: { readOnly: false } });
    return;
  }

  const active = await List.find({ workspaceId, archivedAt: { $exists: false } })
    .sort({ order: 1, createdAt: 1 })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  const keep = active.slice(0, maxLists).map((l) => l._id);
  const freeze = active.slice(maxLists).map((l) => l._id);

  if (keep.length) {
    await List.updateMany({ _id: { $in: keep } }, { $set: { readOnly: false } });
  }
  if (freeze.length) {
    await List.updateMany({ _id: { $in: freeze } }, { $set: { readOnly: true } });
  }
}

/**
 * Read path. Never computes — reads the cache, and falls back to Free (not
 * permissive) when the cache is missing or stale. A user briefly seeing Free
 * limits after a billing outage files a support ticket; a user silently
 * getting Pro for free does not.
 */
export async function readEntitlements(
  workspaceId: Types.ObjectId | string
): Promise<EntitlementSet> {
  await connectDb();

  const row = await EntitlementCache.findOne({ workspaceId }).lean<
    (EntitlementSet & { computedAt: Date }) | null
  >();

  if (!row) {
    console.warn(`[entitlements] cache miss for workspace ${workspaceId}`);
    return degradedEntitlements();
  }

  if (Date.now() - new Date(row.computedAt).getTime() > STALE_AFTER_MS) {
    console.warn(`[entitlements] stale cache for workspace ${workspaceId}`);
    return degradedEntitlements();
  }

  return {
    features: row.features,
    limits: row.limits,
    modules: row.modules ?? [],
    plan: row.plan,
    status: row.status,
  };
}
