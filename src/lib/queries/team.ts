import { connectDb } from "@/lib/db";
import { Workspace } from "@/lib/models/Workspace";
import { User } from "@/lib/models/User";
import { Invitation } from "@/lib/models/Invitation";
import type { MemberRole, WorkspaceType } from "@/lib/types";

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: MemberRole;
  joinedAt: string;
}

export interface TeamData {
  type: WorkspaceType;
  myRole: MemberRole;
  members: TeamMember[];
}

export async function getTeam(workspaceId: string, userId: string): Promise<TeamData | null> {
  await connectDb();

  const workspace = await Workspace.findById(workspaceId)
    .select("type members")
    .populate({ path: "members.userId", model: User, select: "name email avatarUrl" })
    .lean<{
      type: WorkspaceType;
      members: {
        userId: { _id: { toString(): string }; name: string; email: string; avatarUrl?: string } | null;
        role: MemberRole;
        joinedAt: Date;
      }[];
    } | null>();
  if (!workspace) return null;

  // A member whose User row was later deleted shouldn't crash the page —
  // filter rather than assume populate always resolves. Name also falls
  // back to the email's local part: magic-link sign-in never collects a
  // name (unlike an OAuth profile), so older rows predating the auth.ts
  // createUser backfill can still have none.
  const members = workspace.members
    .filter((m) => m.userId)
    .map((m) => ({
      userId: m.userId!._id.toString(),
      name: m.userId!.name || m.userId!.email.split("@")[0],
      email: m.userId!.email,
      avatarUrl: m.userId!.avatarUrl,
      role: m.role,
      joinedAt: new Date(m.joinedAt).toISOString(),
    }));

  const me = members.find((m) => m.userId === userId);

  return { type: workspace.type, myRole: me?.role ?? "member", members };
}

export interface PendingInvite {
  _id: string;
  email: string;
  role: MemberRole;
  expired: boolean;
}

export async function getPendingInvites(workspaceId: string): Promise<PendingInvite[]> {
  await connectDb();

  const invites = await Invitation.find({ workspaceId, status: "pending" })
    .sort({ createdAt: -1 })
    .lean<{ _id: { toString(): string }; email: string; role: MemberRole; expiresAt: Date }[]>();

  const now = Date.now();
  return invites.map((i) => ({
    _id: i._id.toString(),
    email: i.email,
    role: i.role,
    expired: new Date(i.expiresAt).getTime() < now,
  }));
}
