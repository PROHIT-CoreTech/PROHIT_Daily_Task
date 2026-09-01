import { addDays, addWeeks, addMonths, setDate, isAfter } from "date-fns";
import type { TaskDoc } from "@/models/Task";
import type { HydratedDocument } from "mongoose";

type Recurrence = NonNullable<TaskDoc["recurrence"]>;

/**
 * `completionAnchored: false` schedules the next instance from the
 * originally-scheduled date (a Monday standup stays on Mondays even if
 * completed on Wednesday). `completionAnchored: true` schedules from the
 * completion date (water the plants every 7 days from when you actually
 * did it). Spec §1.6 — both are needed.
 */
export function computeNextDueDate(recurrence: Recurrence, scheduledDate: Date, completedAt: Date): Date {
  const anchor = recurrence.completionAnchored ? completedAt : scheduledDate;

  switch (recurrence.freq) {
    case "daily":
      return addDays(anchor, recurrence.interval);
    case "weekly": {
      if (recurrence.byWeekday?.length) {
        let candidate = addDays(anchor, 1);
        for (let i = 0; i < 7 * recurrence.interval; i++) {
          if (recurrence.byWeekday.includes(candidate.getDay())) return candidate;
          candidate = addDays(candidate, 1);
        }
      }
      return addWeeks(anchor, recurrence.interval);
    }
    case "monthly": {
      const next = addMonths(anchor, recurrence.interval);
      return recurrence.byMonthDay ? setDate(next, recurrence.byMonthDay) : next;
    }
  }
}

/**
 * Materialised on completion, not pre-generated — pre-generating an
 * unbounded daily recurrence writes thousands of documents (spec §1.6).
 */
export async function shouldMaterializeNextInstance(
  recurrence: Recurrence,
  nextDueDate: Date,
  existingInstanceCount: number
): Promise<boolean> {
  if (recurrence.until && isAfter(nextDueDate, recurrence.until)) return false;
  if (recurrence.count && existingInstanceCount >= recurrence.count) return false;
  return true;
}

export function buildNextInstance(task: HydratedDocument<TaskDoc>, nextDueDate: Date) {
  return {
    workspaceId: task.workspaceId,
    listId: task.listId,
    title: task.title,
    description: task.description,
    status: "todo" as const,
    boardColumnId: undefined,
    boardOrder: 1000,
    priority: task.priority,
    dueDate: nextDueDate,
    tags: task.tags,
    subtasks: task.subtasks.map((s) => ({ title: s.title, done: false, order: s.order })),
    recurrence: task.recurrence,
    recurrenceParentId: task.recurrenceParentId ?? task._id,
    assigneeId: task.assigneeId,
    createdBy: task.createdBy,
  };
}
