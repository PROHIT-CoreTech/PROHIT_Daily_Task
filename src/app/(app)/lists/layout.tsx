import { getActiveHydration } from "@/lib/queries/activeWorkspace";
import { getLists } from "@/lib/queries/lists";
import { ListSidebar } from "@/components/app/list-sidebar";

export default async function ListsLayout({ children }: { children: React.ReactNode }) {
  const hydration = await getActiveHydration();
  if (!hydration?.activeWorkspaceId) return null; // AppLayout already handles both cases

  const workspaceId = hydration.activeWorkspaceId.toString();
  const lists = await getLists(workspaceId);

  return (
    <div className="flex h-full gap-8">
      <ListSidebar lists={lists} workspaceId={workspaceId} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
