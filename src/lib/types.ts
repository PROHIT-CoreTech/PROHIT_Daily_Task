export type WorkspaceType = "personal" | "team" | "business";
export type Plan = "free" | "pro" | "pro_student" | "team";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "expired";
export type TaskStatus = "todo" | "in_progress" | "done";
export type MemberRole = "owner" | "admin" | "member";

export type FeatureFlag =
  | "flow_board"
  | "calendar_week_view"
  | "calendar_bridge"
  | "unlimited_attachments"
  | "multiple_reminders"
  | "deep_work"
  | "ai_assistant"
  | "team_dashboard";

export type LimitKey =
  | "maxLists"
  | "maxTasksPerList"
  | "maxRemindersPerTask"
  | "maxMembers"
  | "maxAttachmentMb";

export type Features = Record<FeatureFlag, boolean>;
export type Limits = Record<LimitKey, number>;

export interface EntitlementSet {
  features: Features;
  limits: Limits;
  modules: string[];
  plan: Plan;
  status: SubscriptionStatus;
  /** True when served from the degraded fallback rather than a fresh cache row. */
  degraded?: boolean;
}

export const UNLIMITED = -1;
