import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Workspace } from "@/lib/models/Workspace";
import { ApiError, handle, requireRole, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string; userId: string }> };

/** Any member may remove themselves (leave). Removing someone else requires owner/admin. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, userId } = await params;
    const ctx = await requireWorkspaceCtx(id);

    if (!Types.ObjectId.isValid(userId)) throw new ApiError(400, { error: "invalid_user_id" });

    const isSelf = ctx.userId.toString() === userId;
    if (!isSelf) requireRole(ctx, ["owner", "admin"]);

    await connectDb();
    const workspace = await Workspace.findById(ctx.workspaceId)
      .select("ownerId")
      .lean<{ ownerId: Types.ObjectId } | null>();
    if (!workspace) throw new ApiError(404, { error: "workspace_not_found" });

    // A workspace always needs an owner — transferring ownership is a
    // separate, not-yet-built flow, so the owner can't leave or be removed.
    if (workspace.ownerId.toString() === userId) {
      throw new ApiError(400, { error: "cannot_remove_owner" });
    }

    await Workspace.updateOne({ _id: ctx.workspaceId }, { $pull: { members: { userId } } });

    return NextResponse.json({ ok: true });
  });
}
