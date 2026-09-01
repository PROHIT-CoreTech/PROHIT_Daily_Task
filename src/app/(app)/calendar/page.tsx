"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { fetcher } from "@/lib/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { TopNav } from "@/components/layout/TopNav";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { PRIORITY } from "@/lib/constants";
import type { TaskItem } from "@/types/api";

type View = "month" | "week";

export default function CalendarPage() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const canWeekView = activeWorkspace?.entitlements.features.calendar_week_view ?? false;

  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data, mutate } = useSWR<{ tasks: TaskItem[] }>(
    workspaceId ? `/api/v1/workspaces/${workspaceId}/calendar?view=${view}&date=${anchor.toISOString()}` : null,
    fetcher
  );

  const rangeStart = view === "week" ? startOfWeek(anchor, { weekStartsOn: 1 }) : startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const rangeEnd = view === "week" ? endOfWeek(anchor, { weekStartsOn: 1 }) : endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  function tasksOn(day: Date) {
    return data?.tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day)) ?? [];
  }

  function navigate(dir: -1 | 1) {
    setAnchor((prev) => (view === "week" ? (dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1)) : dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1)));
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Calendar" />
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="rounded p-1 hover:bg-black/5">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-primary w-36">{format(anchor, view === "week" ? "d MMM yyyy" : "MMMM yyyy")}</span>
            <button onClick={() => navigate(1)} className="rounded p-1 hover:bg-black/5">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-black/5 p-1">
            <button onClick={() => setView("month")} className={`px-3 py-1 text-xs rounded-md ${view === "month" ? "bg-surface shadow-sm" : ""}`}>
              Month
            </button>
            <button
              onClick={() => (canWeekView ? setView("week") : null)}
              className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md ${view === "week" ? "bg-surface shadow-sm" : ""} ${!canWeekView ? "text-muted" : ""}`}
            >
              {!canWeekView && <Lock size={11} />}
              Week
            </button>
          </div>
        </div>

        {!canWeekView && view === "month" && (
          <Link href="/settings/billing" className="bg-module/10 text-[#8a5a2b] text-xs px-6 py-2 flex items-center gap-1">
            <Lock size={12} /> Free plan shows month view only — upgrade for week and day views.
          </Link>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="bg-black/[0.03] px-2 py-1.5 text-center text-xs font-medium text-muted">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayTasks = tasksOn(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`bg-surface min-h-[100px] p-1.5 ${!isSameMonth(day, anchor) && view === "month" ? "opacity-40" : ""}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday(day) ? "bg-accent text-white font-semibold" : "text-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setOpenTaskId(task.id)}
                        className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px]"
                        style={{ backgroundColor: `${PRIORITY[task.priority].color}20`, color: PRIORITY[task.priority].color }}
                      >
                        {task.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && <span className="text-[10px] text-muted">+{dayTasks.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {openTaskId && <TaskDetailPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} onChanged={mutate} />}
    </div>
  );
}
