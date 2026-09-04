import { Types } from "mongoose";
import { Task } from "@/lib/models/Task";
import { nextDueDate, type Recurrence } from "@/lib/utils/recurrence";

export interface CompletableTask {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  listId: Types.ObjectId;
  title: string;
  description?: string;
  priority: number;
  tags: string[];
  dueDate?: Date;
  completedAt?: Date;
  boardOrder: number;
  recurrence?: Recurrence;
  recurrenceParentId?: Types.ObjectId;
  subtasks: { title: string; order: number }[];
  assigneeId?: Types.ObjectId;
  createdBy: Types.ObjectId;
}

export type CompleteResult =
  | { alreadyComplete: true }
  | { alreadyComplete: false; completedAt: Date; nextTask: unknown };

/**
 * Completes a task and, if it recurs, materialises the next instance. The
 * one place this happens — called from both POST /complete and PATCH
 * /board-position (dropping a card into Done) — so a recurring series
 * behaves identically regardless of which UI action completed it. Takes an
 * already-loaded task rather than an ID so callers that need one anyway
 * (both do, for auth) don't pay for a second fetch.
 */
export async function completeTask(task: CompletableTask): Promise<CompleteResult> {
  if (task.completedAt) return { alreadyComplete: true };

  const completedAt = new Date();
  await Task.updateOne(
    { _id: task._id },
    { $set: { completedAt, status: "done", boardColumnId: "done" } }
  );

  let nextTask = null;

  if (task.recurrence) {
    const seriesId = task.recurrenceParentId ?? task._id;
    const occurrences = await Task.countDocuments({
      $or: [{ recurrenceParentId: seriesId }, { _id: seriesId }],
    });

    const due = nextDueDate(task.recurrence, task.dueDate ?? completedAt, completedAt, occurrences);

    if (due) {
      nextTask = await Task.create({
        workspaceId: task.workspaceId,
        listId: task.listId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        tags: task.tags,
        dueDate: due,
        status: "todo",
        boardColumnId: "todo",
        boardOrder: task.boardOrder,
        recurrence: task.recurrence,
        recurrenceParentId: seriesId,
        assigneeId: task.assigneeId,
        // Subtasks carry over unchecked; reminders and attachments do not.
        subtasks: task.subtasks.map((s) => ({ title: s.title, done: false, order: s.order })),
        createdBy: task.createdBy,
      });
    }
  }

  return { alreadyComplete: false, completedAt, nextTask };
}

/**
 * Reverses completion (e.g. a card dragged out of Done on the Flow Board).
 * Uses $unset, not $set: { completedAt: undefined } — Mongoose strips
 * undefined keys during update casting, so that would silently no-op and
 * leave the stale timestamp in place.
 */
export async function uncompleteTask(taskId: Types.ObjectId): Promise<void> {
  await Task.updateOne({ _id: taskId }, { $unset: { completedAt: 1 } });
}
