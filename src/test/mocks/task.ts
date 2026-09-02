import type { TaskItem } from "@/types/api";

let counter = 0;

/** Builds a fake TaskItem (the client-side API shape) for component tests. */
export function buildTask(overrides: Partial<TaskItem> = {}): TaskItem {
  counter += 1;
  return {
    id: overrides.id ?? `task-${counter}`,
    workspaceId: "workspace-1",
    listId: "list-1",
    title: `Test Task ${counter}`,
    status: "todo",
    boardOrder: 0,
    priority: 0,
    tags: [],
    subtasks: [],
    reminders: [],
    attachments: [],
    createdBy: "user-1",
    ...overrides,
  };
}
