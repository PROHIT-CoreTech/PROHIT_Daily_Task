import { redirect } from "next/navigation";
import { getActiveHydration } from "@/lib/queries/activeWorkspace";
import { getLists } from "@/lib/queries/lists";

export default async function ListsIndexPage() {
  const hydration = await getActiveHydration();
  if (!hydration?.activeWorkspaceId) return null;

  const lists = await getLists(hydration.activeWorkspaceId.toString());
  if (lists.length > 0) redirect(`/lists/${lists[0]._id}`);

  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Create your first list to get started.
    </div>
  );
}
