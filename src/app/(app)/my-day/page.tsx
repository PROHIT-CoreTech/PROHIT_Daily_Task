import { Types } from "mongoose";
import { getActiveHydration } from "@/lib/queries/activeWorkspace";
import { getMyDay } from "@/lib/queries/myDay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TaskRow } from "@/components/app/task-row";

export default async function MyDayPage() {
  const hydration = await getActiveHydration();
  if (!hydration?.activeWorkspaceId) return null; // AppLayout already handles both cases

  const { tasks, stats } = await getMyDay(hydration.activeWorkspaceId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">My Day</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">
            {stats.overdue}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-accent">
            {stats.completionPct}%
          </CardContent>
        </Card>
      </div>

      <Progress value={stats.completionPct} />

      <ul className="flex flex-col gap-2">
        {tasks.length === 0 && (
          <li className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nothing due today.
          </li>
        )}
        {(
          tasks as {
            _id: Types.ObjectId;
            title: string;
            priority: number;
            dueDate?: Date;
            completedAt?: Date;
          }[]
        ).map((task) => (
          <TaskRow
            key={task._id.toString()}
            id={task._id.toString()}
            title={task.title}
            priority={task.priority}
            dueDate={task.dueDate ? new Date(task.dueDate).toISOString() : null}
            completedAt={task.completedAt ? new Date(task.completedAt).toISOString() : null}
          />
        ))}
      </ul>
    </div>
  );
}
