import { NextRequest, NextResponse } from "next/server";
import { withWorkspace, withErrorHandling, forbidden, ApiError } from "@/lib/api/middleware";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  return withErrorHandling(async () => {
    const { id, userId: targetUserId } = await params;
    const { workspace, role, userId } = await withWorkspace(id);

    const isSelf = targetUserId === userId;
    if (!isSelf && role !== "owner" && role !== "admin") {
      throw forbidden("Only owners and admins can remove other members.");
    }
    if (targetUserId === workspace.ownerId.toString()) {
      throw new ApiError(400, { error: "cannot_remove_owner", message: "The workspace owner cannot be removed." });
    }

    workspace.members = workspace.members.filter((m) => m.userId.toString() !== targetUserId) as typeof workspace.members;
    await workspace.save();

    return NextResponse.json({ ok: true });
  });
}
