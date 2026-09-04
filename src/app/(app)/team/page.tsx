import { getActiveHydration } from "@/lib/queries/activeWorkspace";
import { getTeam, getPendingInvites } from "@/lib/queries/team";
import { TeamView } from "@/components/app/team-view";

export default async function TeamPage() {
  const hydration = await getActiveHydration();
  if (!hydration?.activeWorkspaceId || !hydration.user) return null;

  const workspaceId = hydration.activeWorkspaceId.toString();
  const myUserId = hydration.user._id.toString();

  const team = await getTeam(workspaceId, myUserId);
  if (!team) return null;

  const canManage = team.myRole === "owner" || team.myRole === "admin";
  const invites = canManage ? await getPendingInvites(workspaceId) : [];

  return (
    <TeamView
      workspaceId={workspaceId}
      workspaceType={team.type}
      myRole={team.myRole}
      myUserId={myUserId}
      members={team.members}
      invites={invites}
      maxMembers={hydration.entitlements?.limits.maxMembers ?? 1}
    />
  );
}
