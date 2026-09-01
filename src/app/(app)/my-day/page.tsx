"use client";

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { fetcher } from "@/lib/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLists } from "@/hooks/useLists";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { QuickAddTask } from "@/components/tasks/QuickAddTask";
import { TaskRow } from "@/components/tasks/TaskRow";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { QuickRecapCard } from "@/components/ai/QuickRecapCard";
import type { TaskItem } from "@/types/api";

type MyDayResponse = {
  dueToday: TaskItem[];
  overdue: TaskItem[];
  completedToday: number;
  totalToday: number;
};

export default function MyDayPage() {
  const { data: session } = useSession();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data, mutate } = useSWR<MyDayResponse>(
    workspaceId ? `/api/v1/workspaces/${workspaceId}/my-day` : null,
    fetcher
  );
  const { lists } = useLists(workspaceId);
  const { createTask, completeTask } = useTaskMutations(workspaceId, mutate);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const completionPct = data && data.totalToday > 0 ? (data.completedToday / data.totalToday) * 100 : 0;

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="My Day" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-primary">Good Morning, {firstName}</h2>
            <p className="text-sm text-muted">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
          </div>

          <Card className="flex items-center gap-6 p-5">
            <ProgressRing percent={completionPct} />
            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-semibold text-accent">
                  {data?.completedToday ?? 0}/{data?.totalToday ?? 0}
                </p>
                <p className="text-xs text-muted">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-danger">{data?.overdue.length ?? 0}</p>
                <p className="text-xs text-muted">Overdue</p>
              </div>
            </div>
          </Card>

          <QuickRecapCard workspaceId={workspaceId} />

          <Card className="overflow-hidden">
            <QuickAddTask lists={lists} onAdd={(title, listId) => createTask({ listId, title, dueDate: new Date().toISOString() })} />
            {data?.dueToday.length === 0 && data?.overdue.length === 0 && (
              <p className="p-6 text-center text-sm text-muted">Nothing due today. Add a task above to get started.</p>
            )}
            {data?.overdue.map((task) => (
              <TaskRow key={task.id} task={task} onToggleComplete={(t) => completeTask(t.id)} onOpen={(t) => setOpenTaskId(t.id)} />
            ))}
            {data?.dueToday.map((task) => (
              <TaskRow key={task.id} task={task} onToggleComplete={(t) => completeTask(t.id)} onOpen={(t) => setOpenTaskId(t.id)} />
            ))}
          </Card>
        </div>
      </div>

      {openTaskId && <TaskDetailPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} onChanged={mutate} />}
    </div>
  );
}
