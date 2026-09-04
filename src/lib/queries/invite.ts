import { connectDb } from "@/lib/db";
import { Invitation } from "@/lib/models/Invitation";
import { Workspace } from "@/lib/models/Workspace";
import type { MemberRole } from "@/lib/types";

export interface InviteInfo {
  email: string;
  role: MemberRole;
  workspaceName: string;
  status: "pending" | "accepted" | "revoked";
  expired: boolean;
}

/** Read-only lookup backing the /invite/:token landing page — no auth
 * required to view (the token itself is the secret), only to accept. */
export async function getInviteInfo(token: string): Promise<InviteInfo | null> {
  await connectDb();

  const invite = await Invitation.findOne({ token })
    .populate({ path: "workspaceId", model: Workspace, select: "name" })
    .lean<{
      email: string;
      role: MemberRole;
      status: "pending" | "accepted" | "revoked";
      expiresAt: Date;
      workspaceId: { name: string } | null;
    } | null>();
  if (!invite) return null;

  return {
    email: invite.email,
    role: invite.role,
    workspaceName: invite.workspaceId?.name ?? "Workspace",
    status: invite.status,
    expired: new Date(invite.expiresAt).getTime() < Date.now(),
  };
}
