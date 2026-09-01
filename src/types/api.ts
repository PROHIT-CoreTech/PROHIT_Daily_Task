import type { EntitlementSet, Plan } from "@/lib/entitlements/matrix";

export type WorkspaceType = "personal" | "team" | "business";
export type WorkspaceRole = "owner" | "admin" | "member";

export type MeWorkspace = {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceRole;
  entitlements: EntitlementSet;
};

export type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    timezone: string;
    defaultWorkspaceId?: string;
    isStudentVerified: boolean;
  };
  workspaces: MeWorkspace[];
};

export type ListItem = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  icon?: string;
  order: number;
  archivedAt?: string;
};

export type Subtask = { _id: string; title: string; done: boolean; order: number };
export type ReminderItem = { _id: string; remindAt: string; channel: "email"; sentAt?: string };
export type AttachmentItem = {
  _id: string;
  filename: string;
  url: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
};

export type TaskItem = {
  id: string;
  workspaceId: string;
  listId: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done";
  boardColumnId?: string;
  boardOrder: number;
  priority: 0 | 1 | 2 | 3;
  dueDate?: string;
  completedAt?: string;
  tags: string[];
  subtasks: Subtask[];
  reminders: ReminderItem[];
  attachments: AttachmentItem[];
  assigneeId?: string;
  createdBy: string;
};

export type BoardColumn = { id: string; label: string; tasks: TaskItem[] };

export type PlanInfo = {
  plan: Plan;
  amountInr: number;
  interval: "year" | "month";
  features: EntitlementSet["features"];
  limits: EntitlementSet["limits"];
};

export type CommentItem = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
};
