import { connectToDatabase } from "@/lib/db";
import { Workspace } from "@/models/Workspace";
import { Subscription } from "@/models/Subscription";
import { List } from "@/models/List";
import { User } from "@/models/User";
import { recomputeEntitlements } from "@/lib/entitlements/service";
import { BRAND_COLORS } from "@/lib/constants";

/**
 * Every user gets a Personal workspace on signup (spec §1.2). It cannot be
 * deleted or converted — it's the fallback if a user is removed from a team.
 */
export async function provisionPersonalWorkspace(userId: string, userName: string) {
  await connectToDatabase();

  const workspace = await Workspace.create({
    name: `${userName}'s Workspace`,
    type: "personal",
    ownerId: userId,
    members: [{ userId, role: "owner", joinedAt: new Date() }],
  });

  await Subscription.create({
    workspaceId: workspace._id,
    plan: "free",
    status: "active",
    seats: 1,
  });

  await List.create({
    workspaceId: workspace._id,
    name: "My Tasks",
    color: BRAND_COLORS.accent,
    order: 0,
    createdBy: userId,
  });

  await recomputeEntitlements(workspace._id.toString());

  await User.findByIdAndUpdate(userId, { defaultWorkspaceId: workspace._id });

  return workspace;
}
