import type { EntitlementSet, Features, Limits, Plan, WorkspaceType } from "@/lib/types";
import { UNLIMITED } from "@/lib/types";

/**
 * Single source of truth for what each plan unlocks. Lives in code, not the
 * database, so changes are diffable in version control and can't drift per
 * environment.
 *
 * Mirrors BRD v1.0 section 9.1, with two spec decisions applied:
 *   D2 - Flow Board is Pro and above. The wireframe showed it on Free; the BRD
 *        does not, and it is the main paid conversion trigger.
 *   D3 - deep_work is false on every plan for Phase 1. The nav item ships
 *        locked so the layout does not change when v1.1 flips this on.
 */

const NO_FEATURES: Features = {
  flow_board: false,
  calendar_week_view: false,
  calendar_bridge: false,
  unlimited_attachments: false,
  multiple_reminders: false,
  deep_work: false,
  ai_assistant: false,
  team_dashboard: false,
};

export const FREE_LIMITS: Limits = {
  maxLists: 5,
  maxTasksPerList: 50,
  maxRemindersPerTask: 1,
  maxMembers: 1,
  maxAttachmentMb: 0,
};

const PRO_FEATURES: Features = {
  ...NO_FEATURES,
  flow_board: true,
  calendar_week_view: true,
  unlimited_attachments: true,
  multiple_reminders: true,
};

const PRO_LIMITS: Limits = {
  maxLists: UNLIMITED,
  maxTasksPerList: UNLIMITED,
  maxRemindersPerTask: 5,
  maxMembers: 1,
  maxAttachmentMb: 100,
};

export const PLAN_MATRIX: Record<Plan, { features: Features; limits: Limits }> = {
  free: {
    features: { ...NO_FEATURES },
    limits: { ...FREE_LIMITS },
  },
  pro: {
    features: { ...PRO_FEATURES },
    limits: { ...PRO_LIMITS },
  },
  pro_student: {
    // Identical capability to Pro; only the price differs (BRD 9.1).
    features: { ...PRO_FEATURES },
    limits: { ...PRO_LIMITS },
  },
  team: {
    features: { ...PRO_FEATURES, team_dashboard: true },
    limits: {
      maxLists: UNLIMITED,
      maxTasksPerList: UNLIMITED,
      maxRemindersPerTask: 5,
      maxMembers: 10,
      maxAttachmentMb: 500,
    },
  },
};

/**
 * Member caps depend on workspace type as well as plan. A business workspace
 * bills at the same per-seat rate as team but allows a larger org
 * (spec decision D1).
 */
const MEMBER_CAP_BY_TYPE: Partial<Record<WorkspaceType, number>> = {
  business: 50,
};

export function resolveEntitlements(
  plan: Plan,
  type: WorkspaceType,
  opts: { modules?: string[]; aiAddon?: boolean } = {}
): Pick<EntitlementSet, "features" | "limits" | "modules"> {
  const base = PLAN_MATRIX[plan];

  const features: Features = { ...base.features };
  const limits: Limits = { ...base.limits };

  // Gated on a paid plan — every workspace starts on Free regardless of the
  // type chosen at creation, and type alone must not grant Team/Business
  // seat counts to a workspace that never paid for them.
  const typeCap = MEMBER_CAP_BY_TYPE[type];
  if (typeCap !== undefined && plan !== "free") limits.maxMembers = typeCap;

  // Personal workspaces are single-user by definition regardless of plan.
  if (type === "personal") limits.maxMembers = 1;

  // Add-ons are sold separately and are never bundled into a base tier (BRD 9.2).
  if (opts.aiAddon) features.ai_assistant = true;

  const modules = opts.modules ?? [];

  return { features, limits, modules };
}

/** Entitlements served when the cache is missing or stale. Deliberately Free. */
export function degradedEntitlements(): EntitlementSet {
  return {
    features: { ...NO_FEATURES },
    limits: { ...FREE_LIMITS },
    modules: [],
    plan: "free",
    status: "active",
    degraded: true,
  };
}

/** Lowest plan that grants a given feature — drives the upgrade prompt copy. */
export function requiredPlanFor(feature: keyof Features): Plan | null {
  const order: Plan[] = ["free", "pro", "team"];
  for (const plan of order) {
    if (PLAN_MATRIX[plan].features[feature]) return plan;
  }
  return null;
}
