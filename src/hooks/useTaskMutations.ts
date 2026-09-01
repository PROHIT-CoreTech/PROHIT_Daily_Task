import { api } from "@/lib/api-client";
import type { TaskItem } from "@/types/api";

/** Create/update/complete/delete helpers shared across My Day, Calendar, and Flow Board. */
export function useTaskMutations(workspaceId: string | undefined, onChanged: () => void | Promise<unknown>) {
  async function createTask(input: {
    listId: string;
    title: string;
    priority?: 0 | 1 | 2 | 3;
    dueDate?: string;
    tags?: string[];
  }) {
    if (!workspaceId) return;
    await api.post(`/api/v1/workspaces/${workspaceId}/tasks`, input);
    await onChanged();
  }

  async function updateTask(taskId: string, patch: Partial<TaskItem>) {
    await api.patch(`/api/v1/tasks/${taskId}`, patch);
    await onChanged();
  }

  async function completeTask(taskId: string) {
    await api.post(`/api/v1/tasks/${taskId}/complete`);
    await onChanged();
  }

  async function deleteTask(taskId: string) {
    await api.delete(`/api/v1/tasks/${taskId}`);
    await onChanged();
  }

  return { createTask, updateTask, completeTask, deleteTask };
}
