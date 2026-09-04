import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";

export interface MyDay {
  tasks: unknown[];
  stats: {
    total: number;
    completed: number;
    overdue: number;
    completionPct: number;
  };
}

/** Backs Frame 1 (My Day): completion ratio, overdue count, today's tasks. */
export async function getMyDay(workspaceId: Types.ObjectId | string): Promise<MyDay> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  await connectDb();

  const [today, overdue] = await Promise.all([
    Task.find({
      workspaceId,
      dueDate: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ priority: -1, dueDate: 1 })
      .lean<{ completedAt?: Date }[]>(),
    Task.countDocuments({
      workspaceId,
      dueDate: { $lt: startOfDay },
      completedAt: { $exists: false },
    }),
  ]);

  // Completion % is "of today's due tasks, how many are done" — not "tasks
  // completed today" (that set can include yesterday's overdue items
  // finally finished, which isn't the same denominator and made this
  // occasionally read over 100%).
  const completed = today.filter((t) => t.completedAt).length;

  return {
    tasks: today,
    stats: {
      total: today.length,
      completed,
      overdue,
      completionPct: today.length ? Math.round((completed / today.length) * 100) : 0,
    },
  };
}
