import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { ApiError, handle, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string; rid: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, rid } = await params;
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(rid)) {
      throw new ApiError(400, { error: "invalid_id" });
    }

    await connectDb();
    const task = await Task.findOne({ _id: id, "reminders._id": rid }).lean<{
      workspaceId: Types.ObjectId;
    } | null>();
    if (!task) throw new ApiError(404, { error: "reminder_not_found" });

    await requireWorkspaceCtx(task.workspaceId.toString());

    await Task.updateOne({ _id: id }, { $pull: { reminders: { _id: rid } } });

    return NextResponse.json({ ok: true });
  });
}
