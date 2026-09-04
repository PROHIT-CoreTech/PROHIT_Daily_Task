import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";

export interface TaskSummary {
  _id: string;
  title: string;
  description?: string;
  priority: number;
  dueDate?: string;
  completedAt?: string;
  tags: string[];
  assigneeId?: string;
  subtasks: { _id: string; title: string; done: boolean; order: number }[];
  reminders: { _id: string; remindAt: string; sentAt?: string }[];
}

const PAGE_SIZE = 100;

/** Powers the `/lists/:listId` task view. Not React-cached — single use per page. */
export async function getListTasks(
  workspaceId: Types.ObjectId | string,
  listId: string
): Promise<TaskSummary[]> {
  await connectDb();

  const tasks = await Task.find({ workspaceId, listId })
    .sort({ completedAt: 1, createdAt: -1 })
    .limit(PAGE_SIZE)
    .lean<
      {
        _id: { toString(): string };
        title: string;
        description?: string;
        priority: number;
        dueDate?: Date;
        completedAt?: Date;
        tags: string[];
        assigneeId?: { toString(): string };
        subtasks: { _id: { toString(): string }; title: string; done: boolean; order: number }[];
        reminders: { _id: { toString(): string }; remindAt: Date; sentAt?: Date }[];
      }[]
    >();

  return tasks.map((t) => ({
    _id: t._id.toString(),
    title: t.title,
    description: t.description,
    priority: t.priority,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
    completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : undefined,
    tags: t.tags,
    assigneeId: t.assigneeId?.toString(),
    subtasks: t.subtasks.map((s) => ({
      _id: s._id.toString(),
      title: s.title,
      done: s.done,
      order: s.order,
    })),
    reminders: t.reminders.map((r) => ({
      _id: r._id.toString(),
      remindAt: new Date(r.remindAt).toISOString(),
      sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
    })),
  }));
}
