import type { EntitlementSet, FeatureFlags, Limits, Plan } from "@/lib/entitlements/matrix";
import type { MeWorkspace, WorkspaceRole, WorkspaceType } from "@/types/api";

const ALL_FEATURES_OFF: FeatureFlags = {
  flow_board: false,
  calendar_week_view: false,
  calendar_bridge: false,
  unlimited_attachments: false,
  multiple_reminders: false,
  deep_work: false,
  ai_assistant: false,
  team_dashboard: false,
};

const DEFAULT_LIMITS: Limits = {
  maxLists: 5,
  maxTasksPerList: 50,
  maxRemindersPerTask: 1,
  maxMembers: 1,
  maxAttachmentMb: 0,
};

/** Builds a fake MeWorkspace for component tests. Every feature flag defaults
 * off (Free-shaped) — pass `features`/`limits` overrides to simulate a paid plan. */
export function buildWorkspace(overrides: {
  id?: string;
  name?: string;
  type?: WorkspaceType;
  role?: WorkspaceRole;
  plan?: Plan;
  features?: Partial<FeatureFlags>;
  limits?: Partial<Limits>;
} = {}): MeWorkspace {
  const entitlements: EntitlementSet = {
    plan: overrides.plan ?? "free",
    features: { ...ALL_FEATURES_OFF, ...overrides.features },
    limits: { ...DEFAULT_LIMITS, ...overrides.limits },
  };

  return {
    id: overrides.id ?? "workspace-1",
    name: overrides.name ?? "Test Workspace",
    type: overrides.type ?? "personal",
    role: overrides.role ?? "owner",
    entitlements,
  };
}

/** Return value shape for a mocked `useWorkspace()` hook. */
export function buildUseWorkspaceReturn(workspace: MeWorkspace | undefined = buildWorkspace()) {
  return {
    me: workspace
      ? {
          user: {
            id: "user-1",
            name: "Test User",
            email: "test@example.com",
            timezone: "Asia/Kolkata",
            isStudentVerified: false,
          },
          workspaces: [workspace],
        }
      : undefined,
    isLoading: false,
    activeWorkspace: workspace,
    setActiveWorkspaceId: () => {},
    refresh: async () => undefined,
  };
}
