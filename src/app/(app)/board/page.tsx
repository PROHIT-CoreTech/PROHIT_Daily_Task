import { getActiveHydration } from "@/lib/queries/activeWorkspace";
import { getBoard } from "@/lib/queries/board";
import { BoardView } from "@/components/app/board-view";
import { UpgradePrompt } from "@/components/app/upgrade-prompt";

export default async function BoardPage() {
  const hydration = await getActiveHydration();
  if (!hydration?.activeWorkspaceId) return null;

  // Same 402 contract the API enforces (requireFeature in the board route) —
  // rendered as a page instead of an error since there's no request to gate.
  if (!hydration.entitlements?.features.flow_board) {
    return (
      <UpgradePrompt
        feature="Flow Board"
        message="Flow Board is available on Pro and Team plans."
      />
    );
  }

  const columns = await getBoard(hydration.activeWorkspaceId.toString());

  return <BoardView initialColumns={columns} />;
}
