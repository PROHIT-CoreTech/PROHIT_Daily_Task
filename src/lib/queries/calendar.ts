import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { Workspace } from "@/lib/models/Workspace";
import { dateKey, monthGridDays, weekDays } from "@/lib/utils/calendarGrid";

export type CalendarViewMode = "month" | "week";

export interface CalendarTaskSummary {
  _id: string;
  title: string;
  priority: number;
  completedAt?: string;
}

export interface CalendarDay {
  date: string;
  inCurrentPeriod: boolean;
  tasks: CalendarTaskSummary[];
}

export async function getWeekStartsOn(workspaceId: string): Promise<0 | 1> {
  await connectDb();
  const workspace = await Workspace.findById(workspaceId)
    .select("settings.weekStartsOn")
    .lean<{ settings?: { weekStartsOn?: 0 | 1 } } | null>();
  return workspace?.settings?.weekStartsOn ?? 1;
}

export async function getCalendar(
  workspaceId: string,
  view: CalendarViewMode,
  anchor: Date,
  weekStartsOn: 0 | 1
): Promise<CalendarDay[]> {
  await connectDb();

  const days = view === "month" ? monthGridDays(anchor, weekStartsOn) : weekDays(anchor, weekStartsOn);
  const start = days[0];
  const end = new Date(days[days.length - 1]);
  end.setHours(23, 59, 59, 999);

  const tasks = await Task.find({ workspaceId, dueDate: { $gte: start, $lte: end } })
    .select("title priority dueDate completedAt")
    .sort({ priority: -1 })
    .lean<
      {
        _id: { toString(): string };
        title: string;
        priority: number;
        dueDate: Date;
        completedAt?: Date;
      }[]
    >();

  const byDay = new Map<string, CalendarTaskSummary[]>();
  for (const t of tasks) {
    const key = dateKey(new Date(t.dueDate));
    const list = byDay.get(key) ?? [];
    list.push({
      _id: t._id.toString(),
      title: t.title,
      priority: t.priority,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : undefined,
    });
    byDay.set(key, list);
  }

  return days.map((d) => ({
    date: dateKey(d),
    inCurrentPeriod: view === "week" ? true : d.getMonth() === anchor.getMonth(),
    tasks: byDay.get(dateKey(d)) ?? [],
  }));
}
