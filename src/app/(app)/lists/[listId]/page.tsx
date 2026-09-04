import { notFound } from "next/navigation";
import { getActiveHydration } from "@/lib/queries/activeWorkspace";
import { getList } from "@/lib/queries/lists";
import { getListTasks } from "@/lib/queries/tasks";
import { getTeam } from "@/lib/queries/team";
import { TaskListView } from "@/components/app/task-list-view";

type Params = { params: Promise<{ listId: string }> };

export default async function ListPage({ params }: Params) {
  const { listId } = await params;
  const hydration = await getActiveHydration();
  if (!hydration?.activeWorkspaceId || !hydration.user) return null;

  const workspaceId = hydration.activeWorkspaceId.toString();
  const list = await getList(workspaceId, listId);
  if (!list) notFound();

  if (list.archived) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        This list is archived.
      </div>
    );
  }

  const [tasks, team] = await Promise.all([
    getListTasks(workspaceId, listId),
    getTeam(workspaceId, hydration.user._id.toString()),
  ]);

  return <TaskListView list={list} initialTasks={tasks} members={team?.members ?? []} />;
}
