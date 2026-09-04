import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Invitation } from "@/lib/models/Invitation";
import { ApiError, handle, requireRole, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string; inviteId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, inviteId } = await params;
    const ctx = await requireWorkspaceCtx(id);
    requireRole(ctx, ["owner", "admin"]);

    if (!Types.ObjectId.isValid(inviteId)) {
      throw new ApiError(400, { error: "invalid_invite_id" });
    }

    await connectDb();
    const invite = await Invitation.findOneAndUpdate(
      { _id: inviteId, workspaceId: ctx.workspaceId, status: "pending" },
      { $set: { status: "revoked" } }
    );
    if (!invite) throw new ApiError(404, { error: "invite_not_found" });

    return NextResponse.json({ ok: true });
  });
}
