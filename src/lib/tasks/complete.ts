import { Task } from "@/models/Task";
import { computeNextDueDate, shouldMaterializeNextInstance, buildNextInstance } from "./recurrence";

/**
 * Marks a task complete and, if it recurs, materialises the next instance.
 * Called from both POST /tasks/:id/complete and the board-position handler
 * when a card is dropped in the "done" column — one code path (spec §3).
 */
export async function completeTask(taskId: string) {
  const task = await Task.findById(taskId);
  if (!task) return null;

  const completedAt = new Date();
  task.completedAt = completedAt;
  task.status = "done";
  await task.save();

  if (task.recurrence && task.dueDate) {
    const nextDueDate = computeNextDueDate(task.recurrence, task.dueDate, completedAt);
    const rootId = (task.recurrenceParentId ?? task._id).toString();
    const existingInstanceCount = await Task.countDocuments({
      $or: [{ _id: rootId }, { recurrenceParentId: rootId }],
    });

    if (await shouldMaterializeNextInstance(task.recurrence, nextDueDate, existingInstanceCount)) {
      await Task.create(buildNextInstance(task, nextDueDate));
    }
  }

  return task;
}
