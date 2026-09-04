import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Invitation } from "@/lib/models/Invitation";
import { Workspace } from "@/lib/models/Workspace";
import { ApiError, handle } from "@/lib/api/guard";

type Params = { params: Promise<{ token: string }> };

/**
 * Invites are bound to an email, not a pre-existing user — the invitee may
 * not have an account yet. Accepting therefore needs a live session (so
 * NextAuth's magic link has already created/matched the User) whose email
 * matches the invite, rather than any notion of "user ID from the invite".
 */
export async function POST(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { token } = await params;

    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    if (!sessionUser?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    await connectDb();
    const invite = await Invitation.findOne({ token });
    if (!invite) throw new ApiError(404, { error: "invite_not_found" });
    if (invite.status !== "pending") throw new ApiError(410, { error: "invite_already_used" });
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new ApiError(410, { error: "invite_expired" });
    }
    if (!sessionUser.email || sessionUser.email.toLowerCase() !== invite.email) {
      throw new ApiError(403, { error: "invite_email_mismatch" });
    }

    const userId = new Types.ObjectId(sessionUser.id);

    // Atomic pending -> accepted transition, same guard shape as the
    // Razorpay webhook: the filter itself prevents two concurrent accepts
    // (e.g. a double click) from both succeeding.
    const accepted = await Invitation.findOneAndUpdate(
      { _id: invite._id, status: "pending" },
      { $set: { status: "accepted", acceptedAt: new Date(), acceptedBy: userId } },
      { new: true }
    );
    if (!accepted) throw new ApiError(410, { error: "invite_already_used" });

    const updatedWorkspace = await Workspace.findOneAndUpdate(
      { _id: invite.workspaceId, "members.userId": { $ne: userId } },
      { $push: { members: { userId, role: invite.role, joinedAt: new Date() } } },
      { new: true }
    );

    // Rejoin edge case (left, re-invited, already back by the time this
    // runs): the invite is consumed above either way, not an error here.
    const workspace = updatedWorkspace ?? (await Workspace.findById(invite.workspaceId).lean());

    return NextResponse.json({ workspace });
  });
}
