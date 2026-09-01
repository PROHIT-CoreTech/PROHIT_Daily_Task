// Plan -> entitlement matrix. Single source of truth for feature gating,
// kept in version control (not the DB) so changes are diffable/reviewable.
// See PROHIT_Data_Model_and_API_Spec_v1.md §1.4 for the reasoning.

export type Plan = "free" | "pro" | "pro_student" | "team";

export type FeatureFlags = {
  flow_board: boolean;
  calendar_week_view: boolean;
  calendar_bridge: boolean; // Phase 2 — Google Calendar sync, bundled into Pro/Team like Flow Board
  unlimited_attachments: boolean;
  multiple_reminders: boolean;
  deep_work: boolean; // V1.1 fast-follow (BRD §5.2) — Pro/Team only, same gating pattern as Flow Board
  ai_assistant: boolean; // Phase 2
  team_dashboard: boolean;
};

export type Limits = {
  maxLists: number; // -1 = unlimited
  maxTasksPerList: number;
  maxRemindersPerTask: number;
  maxMembers: number;
  maxAttachmentMb: number;
};

export type EntitlementSet = {
  plan: Plan;
  features: FeatureFlags;
  limits: Limits;
};

const FREE: EntitlementSet = {
  plan: "free",
  features: {
    flow_board: false,
    calendar_week_view: false,
    calendar_bridge: false,
    unlimited_attachments: false,
    multiple_reminders: false,
    deep_work: false,
    ai_assistant: false,
    team_dashboard: false,
  },
  limits: {
    maxLists: 5,
    maxTasksPerList: 50,
    maxRemindersPerTask: 1,
    maxMembers: 1,
    maxAttachmentMb: 0,
  },
};

const PRO: EntitlementSet = {
  plan: "pro",
  features: {
    flow_board: true,
    calendar_week_view: true,
    calendar_bridge: true,
    unlimited_attachments: true,
    multiple_reminders: true,
    deep_work: true,
    ai_assistant: false,
    team_dashboard: false,
  },
  limits: {
    maxLists: -1,
    maxTasksPerList: -1,
    maxRemindersPerTask: 5,
    maxMembers: 1,
    maxAttachmentMb: 100,
  },
};

const PRO_STUDENT: EntitlementSet = { ...PRO, plan: "pro_student" };

function teamEntitlements(maxMembers: number): EntitlementSet {
  return {
    plan: "team",
    features: {
      flow_board: true,
      calendar_week_view: true,
      calendar_bridge: true,
      unlimited_attachments: true,
      multiple_reminders: true,
      deep_work: true,
      ai_assistant: false,
      team_dashboard: true,
    },
    limits: {
      maxLists: -1,
      maxTasksPerList: -1,
      maxRemindersPerTask: 5,
      maxMembers,
      maxAttachmentMb: 500,
    },
  };
}

// Workspace `type` and billing `plan` are independent axes (spec §D1).
// `type` determines the member cap ceiling when plan === "team".
export function entitlementsFor(plan: Plan, workspaceType: "personal" | "team" | "business"): EntitlementSet {
  switch (plan) {
    case "free":
      return FREE;
    case "pro":
      return PRO;
    case "pro_student":
      return PRO_STUDENT;
    case "team":
      return teamEntitlements(workspaceType === "business" ? 50 : 10);
  }
}

export const PLAN_ALLOWED_TYPES: Record<Plan, Array<"personal" | "team" | "business">> = {
  free: ["personal"],
  pro: ["personal"],
  pro_student: ["personal"],
  team: ["team", "business"],
};

export const PLAN_PRICING: Record<Plan, { amountInr: number; interval: "year" | "month" }> = {
  free: { amountInr: 0, interval: "year" },
  pro: { amountInr: 999, interval: "year" },
  pro_student: { amountInr: 499, interval: "year" },
  team: { amountInr: 149, interval: "month" }, // per user
};

// AI Add-on — sold separately on top of any base plan, not bundled into Pro
// (BRD §9.2, §5.2). Available regardless of plan/workspace type, unlike
// vertical modules which require a Team-tier Business workspace.
export const AI_ADDON_PRICING = { amountInr: 99, interval: "month" as const }; // per user

