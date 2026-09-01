import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { ApiError, withWorkspace } from "@/lib/api/middleware";

/** Loads a task by id and authorizes the caller against its workspace. */
export async function loadAuthorizedTask(taskId: string) {
  await connectToDatabase();
  const task = await Task.findById(taskId);
  if (!task) throw new ApiError(404, { error: "not_found", message: "Task not found." });

  const ctx = await withWorkspace(task.workspaceId.toString());
  return { task, ...ctx };
}
