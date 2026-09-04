"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const PRIORITY_LABEL = ["", "Low", "Medium", "High"] as const;

export function TaskRow({
  id,
  title,
  priority,
  dueDate,
  completedAt,
}: {
  id: string;
  title: string;
  priority: number;
  dueDate?: string | null;
  completedAt?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(Boolean(completedAt));

  async function complete() {
    if (done) return;
    setDone(true);
    const res = await fetch(`/api/v1/tasks/${id}/complete`, { method: "POST" });
    if (!res.ok) {
      setDone(false);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
      <input
        type="checkbox"
        checked={done}
        disabled={done || pending}
        onChange={complete}
        className="size-4 accent-accent"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through")}>
          {title}
        </p>
        {dueDate && (
          <p className="text-xs text-muted-foreground">
            Due {new Date(dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      {priority > 0 && (
        <span className="rounded-full bg-module px-2 py-0.5 text-xs font-medium text-module-foreground">
          {PRIORITY_LABEL[priority]}
        </span>
      )}
    </li>
  );
}
