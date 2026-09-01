"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";

type StatsResponse = {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  overdueTasks: number;
  trend: { date: string; completed: number }[];
};

export default function StatsPage() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const { data } = useSWR<StatsResponse>(workspaceId ? `/api/v1/workspaces/${workspaceId}/stats` : null, fetcher);
  const maxTrend = Math.max(1, ...(data?.trend.map((t) => t.completed) ?? [1]));

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav title="Stats" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-2xl font-semibold text-primary">{data?.totalTasks ?? "–"}</p>
            <p className="text-xs text-muted">Total tasks</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-semibold text-accent">{data?.completionRate ?? "–"}%</p>
            <p className="text-xs text-muted">Completion rate</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-semibold text-primary">{data?.completedTasks ?? "–"}</p>
            <p className="text-xs text-muted">Completed</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-semibold text-danger">{data?.overdueTasks ?? "–"}</p>
            <p className="text-xs text-muted">Overdue</p>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-primary mb-4">Completed — last 14 days</h3>
          <div className="flex items-end gap-1.5 h-32">
            {data?.trend.map((t) => (
              <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-accent min-h-[2px]"
                  style={{ height: `${(t.completed / maxTrend) * 100}%` }}
                  title={`${t.date}: ${t.completed}`}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
