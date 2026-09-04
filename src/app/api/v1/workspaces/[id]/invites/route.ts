import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Invitation } from "@/lib/models/Invitation";
import { Workspace } from "@/lib/models/Workspace";
import { User } from "@/lib/models/User";
import { sendInviteEmail } from "@/lib/mail";
import { ApiError, handle, requireLimit, requireRole, requireWorkspaceCtx } from "@/lib/api/guard";
import type { Types } from "mongoose";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);
    requireRole(ctx, ["owner", "admin"]);

    await connectDb();
    const invites = await Invitation.find({ workspaceId: ctx.workspaceId, status: "pending" })
      .sort({ createdAt: -1 })
      .lean<{ expiresAt: Date }[]>();

    const now = Date.now();
    const withExpiry = invites.map((invite) => ({
      ...invite,
      expired: new Date(invite.expiresAt).getTime() < now,
    }));

    return NextResponse.json({ invites: withExpiry });
  });
}

const CreateInvite = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase()),
  role: z.enum(["admin", "member"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);
    requireRole(ctx, ["owner", "admin"]);

    const parsed = CreateInvite.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { email, role } = parsed.data;

    await connectDb();

    const [workspace, inviter, existingUser, pendingCount, existingInvite] = await Promise.all([
      Workspace.findById(ctx.workspaceId)
        .select("members name")
        .lean<{ members: { userId: Types.ObjectId }[]; name: string } | null>(),
      User.findById(ctx.userId).select("name").lean<{ name: string } | null>(),
      User.findOne({ email }).select("_id").lean<{ _id: Types.ObjectId } | null>(),
      // Excludes this email's own pending row — resending an invite must not
      // count against the seat cap twice.
      Invitation.countDocuments({
        workspaceId: ctx.workspaceId,
        status: "pending",
        email: { $ne: email },
      }),
      Invitation.findOne({ workspaceId: ctx.workspaceId, status: "pending", email }),
    ]);

    if (!workspace) throw new ApiError(404, { error: "workspace_not_found" });

    if (existingUser && workspace.members.some((m) => m.userId.equals(existingUser._id))) {
      throw new ApiError(409, { error: "already_member" });
    }

    requireLimit(ctx, "maxMembers", workspace.members.length + pendingCount);

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    let invite;
    let status: 200 | 201;
    if (existingInvite) {
      existingInvite.set({ role, token, expiresAt, invitedBy: ctx.userId });
      invite = await existingInvite.save();
      status = 200;
    } else {
      invite = await Invitation.create({
        workspaceId: ctx.workspaceId,
        email,
        role,
        token,
        expiresAt,
        invitedBy: ctx.userId,
      });
      status = 201;
    }

    const acceptUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;
    sendInviteEmail({
      to: email,
      workspaceName: workspace.name,
      inviterName: inviter?.name ?? "A teammate",
      acceptUrl,
    }).catch((err) => console.error("[invites] failed to send invite email", err));

    return NextResponse.json({ invite }, { status });
  });
}
