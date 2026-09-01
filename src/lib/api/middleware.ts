import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Workspace, type WorkspaceDoc } from "@/models/Workspace";
import { getEntitlements } from "@/lib/entitlements/service";
import type { EntitlementSet } from "@/lib/entitlements/matrix";
import type { HydratedDocument } from "mongoose";
import { ApiError, unauthorized, forbidden } from "./errors";

export { ApiError, unauthorized, forbidden, requireFeature, requireLimit, withErrorHandling } from "./errors";

export type AuthedContext = {
  userId: string;
};

export type WorkspaceContext = AuthedContext & {
  workspace: HydratedDocument<WorkspaceDoc>;
  role: "owner" | "admin" | "member";
};

export type EntitledContext = WorkspaceContext & {
  entitlements: EntitlementSet;
};

/** Resolves the session; throws 401 on failure. Spec §2.1 step 1. */
export async function withAuth(): Promise<AuthedContext> {
  const session = await auth();
  if (!session?.user?.id) throw unauthorized();
  return { userId: session.user.id };
}

/** Resolves the workspace and confirms membership; throws 403 on failure. Spec §2.1 step 2. */
export async function withWorkspace(workspaceId: string): Promise<WorkspaceContext> {
  const ctx = await withAuth();
  await connectToDatabase();

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new ApiError(404, { error: "not_found", message: "Workspace not found." });

  const membership = workspace.members.find((m) => m.userId.toString() === ctx.userId);
  if (!membership) throw forbidden("You are not a member of this workspace.");

  return { ...ctx, workspace, role: membership.role as WorkspaceContext["role"] };
}

/** Loads the entitlement cache for the workspace. Spec §2.1 step 3. */
export async function withEntitlements(workspaceId: string): Promise<EntitledContext> {
  const ctx = await withWorkspace(workspaceId);
  const entitlements = await getEntitlements(workspaceId);
  return { ...ctx, entitlements };
}
