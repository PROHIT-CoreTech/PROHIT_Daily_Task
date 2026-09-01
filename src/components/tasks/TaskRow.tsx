"use client";

import { Check, Paperclip } from "lucide-react";
import { format, isPast } from "date-fns";
import { PRIORITY } from "@/lib/constants";
import type { TaskItem } from "@/types/api";

export function TaskRow({
  task,
  onToggleComplete,
  onOpen,
}: {
  task: TaskItem;
  onToggleComplete: (task: TaskItem) => void;
  onOpen: (task: TaskItem) => void;
}) {
  const done = Boolean(task.completedAt);
  const overdue = !done && task.dueDate && isPast(new Date(task.dueDate));
  const priority = PRIORITY[task.priority];
  const subtaskDone = task.subtasks.filter((s) => s.done).length;

  return (
    <div
      onClick={() => onOpen(task)}
      className="flex items-center gap-3 border-b border-border px-4 py-3 cursor-pointer hover:bg-black/[0.02]"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete(task);
        }}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          done ? "bg-accent border-accent" : "border-border hover:border-accent"
        }`}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done && <Check size={12} className="text-white" />}
      </button>

      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: priority.color }}
        title={`Priority: ${priority.label}`}
      />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${done ? "text-muted line-through" : "text-foreground"}`}>{task.title}</p>
        {task.tags.length > 0 && (
          <div className="mt-1 flex gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
        {task.subtasks.length > 0 && (
          <span>
            {subtaskDone}/{task.subtasks.length}
          </span>
        )}
        {task.attachments.length > 0 && <Paperclip size={13} />}
        {task.dueDate && (
          <span className={overdue ? "text-danger font-medium" : ""}>{format(new Date(task.dueDate), "d MMM")}</span>
        )}
      </div>
    </div>
  );
}
